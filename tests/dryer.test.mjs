import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('dryer is wired into every machine guard chain next to foragers', () => {
  const foragerChains = (js.match(/!?foragers\.has\(/g) || []).length;
  const dryerChains = (js.match(/!?dryers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про грибники, має знати і про сушарки
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(dryerChains >= foragerChains - 8,
    `dryers.has: ${dryerChains}, foragers.has: ${foragerChains}`);
});

test('dryer ticks with the other machines after the foragers', () => {
  assert.match(js, /updateForagers\(dt\);[\s\S]{0,300}updateDryers\(dt\);/);
});

test('dryer needs a chest with raw mushrooms and roast shelf space', () => {
  // скриня впритул береться лише з сирими грибами і місцем на полиці печених
  assert.match(js, /\(ch\.store\.mush \|\| 0\) >= 1 && \(ch\.store\.roast \|\| 0\) < CHEST_STACK/);
  // без скрині — жаровня гріє дарма
  assert.match(js, /const chest = dryerChest\(d\);/);
});

test('dryer exchange is atomic at the moment of readiness (nothing to lose)', () => {
  // сирий гриб сходить з полиці і печений лягає всередині dryerFinish —
  // зламана сушарка нічого не губить
  assert.match(js, /function dryerFinish\(d, chest\)/);
  assert.match(js, /chest\.store\.mush -= 1;\s*\n\s*chest\.store\.roast = \(chest\.store\.roast \|\| 0\) \+ 1;/);
  assert.match(js, /d\.dried = \(d\.dried \| 0\) \+ 1;/);
});

test('dryer achievements are registered', () => {
  assert.match(js, /id: 'autodry'/);
  assert.match(js, /id: 'dryworks'/);
});

test('dryer is saved and restored with the world', () => {
  assert.match(js, /dryers: \[\.\.\.dryers\.values\(\)\]/);
  assert.match(js, /savedGame\.dryers/);
});

test('controls help documents the dryer (desktop and touch)', () => {
  const entries = html.match(/Сушарка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
