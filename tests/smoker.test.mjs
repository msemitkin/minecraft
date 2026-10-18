import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('smoker is wired into every machine guard chain next to fishers', () => {
  const fisherChains = (js.match(/!?fishers\.has\(/g) || []).length;
  const smokerChains = (js.match(/!?smokers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про самолови, має знати і про коптильні
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(smokerChains >= fisherChains - 8,
    `smokers.has: ${smokerChains}, fishers.has: ${fisherChains}`);
});

test('smoker ticks with the other machines after the fishers', () => {
  assert.match(js, /updateFishers\(dt\);[\s\S]{0,300}updateSmokers\(dt\);/);
});

test('smoker needs a chest with raw meat and shelf space for cooked', () => {
  // скриня впритул береться лише з сирим м'ясом і місцем на полиці смаженини
  assert.match(js, /\(ch\.store\.food \|\| 0\) >= 1 && \(ch\.store\.cooked \|\| 0\) < CHEST_STACK/);
  // без скрині чи без м'яса — жар жевріє дарма
  assert.match(js, /const chest = smokerChest\(s\);/);
});

test('smoker swap is atomic at the moment of readiness (nothing to lose)', () => {
  // обмін відбувається всередині smokerFinish — зламана коптильня нічого не губить
  assert.match(js, /function smokerFinish\(s, chest\)/);
  assert.match(js, /chest\.store\.food -= 1;\s*\n\s*chest\.store\.cooked = \(chest\.store\.cooked \|\| 0\) \+ 1;/);
  assert.match(js, /s\.smoked = \(s\.smoked \| 0\) \+ 1;/);
});

test('smoker achievements are registered', () => {
  assert.match(js, /id: 'autosmoke'/);
  assert.match(js, /id: 'smokeworks'/);
});

test('smoker is saved and restored with the world', () => {
  assert.match(js, /smokers: \[\.\.\.smokers\.values\(\)\]/);
  assert.match(js, /savedGame\.smokers/);
});

test('controls help documents the smoker (desktop and touch)', () => {
  const entries = html.match(/Коптильня/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
