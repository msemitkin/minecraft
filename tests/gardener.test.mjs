import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('gardener is wired into every machine guard chain next to steamers', () => {
  const steamerChains = (js.match(/!?steamers\.has\(/g) || []).length;
  const gardenerChains = (js.match(/!?gardeners\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про парні, має знати і про садівники
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(gardenerChains >= steamerChains - 8,
    `gardeners.has: ${gardenerChains}, steamers.has: ${steamerChains}`);
});

test('gardener ticks with the other machines after the steamers', () => {
  assert.match(js, /updateSteamers\(dt\);[\s\S]{0,400}updateGardeners\(dt\);/);
});

test('gardener needs a cactus fruit in reach and a chest with shelf space', () => {
  // скриня впритул береться лише з місцем на полиці плодів опунції
  assert.match(js, /\(ch\.store\.fruit \| 0\) < CHEST_STACK/);
  // без плоду в сягу чи без скрині — жердина чекає впорожні
  assert.match(js, /const found = gardenerFruit\(g\);/);
  assert.match(js, /const chest = gardenerChest\(g\);/);
  // сяг садівника обмежений по горизонталі і тягнеться вгору до верхівок
  assert.match(js, /GARDENER_REACH_UP/);
});

test('gardener pick is atomic at the moment of picking (nothing to lose)', () => {
  // плід зникає зі світу і лягає на полицю всередині gardenerFinish —
  // зламаний садівник нічого не губить
  assert.match(js, /function gardenerFinish\(g, chest, fKey, f\)/);
  assert.match(js, /removeCactusFruit\(fKey\);\s*\n\s*chest\.store\.fruit = Math\.min\(CHEST_STACK, \(chest\.store\.fruit \| 0\) \+ 1\);/);
  assert.match(js, /g\.picked = \(g\.picked \| 0\) \+ 1;/);
});

test('hand path stays: fruits are still knocked down by a shot', () => {
  // постріл і підбирання збитого плоду нікуди не діваються
  assert.match(js, /FRUIT_PICKUP_R/);
  assert.match(js, /FRUIT_HIT_R/);
});

test('gardener achievements are registered', () => {
  assert.match(js, /id: 'autogarden'/);
  assert.match(js, /id: 'gardenworks'/);
});

test('gardener is saved and restored with the world', () => {
  assert.match(js, /gardeners: \[\.\.\.gardeners\.values\(\)\]/);
  assert.match(js, /savedGame\.gardeners/);
});

test('controls help documents the gardener (desktop and touch)', () => {
  const entries = html.match(/Садівник/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
