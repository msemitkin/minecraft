import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('forager is wired into every machine guard chain next to smokers', () => {
  const smokerChains = (js.match(/!?smokers\.has\(/g) || []).length;
  const foragerChains = (js.match(/!?foragers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про коптильні, має знати і про грибники
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(foragerChains >= smokerChains - 8,
    `foragers.has: ${foragerChains}, smokers.has: ${smokerChains}`);
});

test('forager ticks with the other machines after the smokers', () => {
  assert.match(js, /updateSmokers\(dt\);[\s\S]{0,300}updateForagers\(dt\);/);
});

test('forager needs a mushroom in reach and a chest with shelf space', () => {
  // скриня впритул береться лише з місцем на полиці сирих грибів
  assert.match(js, /\(ch\.store\.mush \| 0\) < CHEST_STACK/);
  // без гриба в сягу чи без скрині — кошик чекає впорожні
  assert.match(js, /const found = foragerMushroom\(f\);/);
  assert.match(js, /const chest = foragerChest\(f\);/);
  // сяг грибника обмежений і по горизонталі, і по вертикалі
  assert.match(js, /FORAGER_REACH_Y/);
});

test('forager pick is atomic at the moment of picking (nothing to lose)', () => {
  // гриб зникає зі світу і лягає на полицю всередині foragerFinish —
  // зламаний грибник нічого не губить
  assert.match(js, /function foragerFinish\(f, chest, mKey, m\)/);
  assert.match(js, /removeMushroom\(mKey\);\s*\n\s*chest\.store\.mush = Math\.min\(CHEST_STACK, \(chest\.store\.mush \| 0\) \+ 1\);/);
  assert.match(js, /f\.picked = \(f\.picked \| 0\) \+ 1;/);
});

test('forager achievements are registered', () => {
  assert.match(js, /id: 'autoforage'/);
  assert.match(js, /id: 'forageworks'/);
});

test('forager is saved and restored with the world', () => {
  assert.match(js, /foragers: \[\.\.\.foragers\.values\(\)\]/);
  assert.match(js, /savedGame\.foragers/);
});

test('controls help documents the forager (desktop and touch)', () => {
  const entries = html.match(/Грибник/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
