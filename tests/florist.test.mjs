import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('florist is wired into every machine guard chain next to roasters', () => {
  const roasterChains = (js.match(/!?roasters\.has\(/g) || []).length;
  const floristChains = (js.match(/!?florists\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про запікальні, має знати і про квітникарі
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(floristChains >= roasterChains - 8,
    `florists.has: ${floristChains}, roasters.has: ${roasterChains}`);
});

test('florist ticks with the other machines after the roasters', () => {
  assert.match(js, /updateRoasters\(dt\);[\s\S]{0,400}updateFlorists\(dt\);/);
});

test('florist needs a wild flower in reach and a chest with space on ITS shelf', () => {
  // полиця береться за видом квітки: мак/кульбаба/волошка — у кожної своя
  assert.match(js, /floristChest\(fl, FLOWER_KINDS\[f\.kind\]\.bag\)/);
  assert.match(js, /\(ch\.store\[bag\] \| 0\) < CHEST_STACK/);
  // без дикої квітки в сягу чи без скрині — щипці чекають впорожні
  assert.match(js, /const found = floristTarget\(fl\);/);
  // сяг квітникаря обмежений по горизонталі й вертикалі
  assert.match(js, /FLORIST_REACH_Y/);
});

test('florist picks only wild flowers, planted gardens are untouchable', () => {
  // і пошук для підказки, і ціль тику пропускають посаджені квіти
  const skips = (js.match(/if \(f\.planted\) continue;/g) || []).length;
  assert.ok(skips >= 2, `знайдено ${skips} пропусків садових квітів`);
});

test('florist pick is atomic at the moment of plucking (nothing to lose)', () => {
  // квітка зникає зі світу і лягає на полицю всередині floristFinish —
  // зламаний квітникар нічого не губить
  assert.match(js, /function floristFinish\(fl, chest, fKey, f\)/);
  assert.match(js, /removeFlower\(fKey\);\s*\n\s*chest\.store\[kind\.bag\] = Math\.min\(CHEST_STACK, \(chest\.store\[kind\.bag\] \| 0\) \+ 1\);/);
  assert.match(js, /fl\.plucked = \(fl\.plucked \| 0\) \+ 1;/);
});

test('hand path stays: flowers are still picked into the bag by hand', () => {
  // ЛКМ-зривання в торбу нікуди не дівається
  assert.match(js, /function pickFlower\(key\)/);
  assert.match(js, /player\[kind\.bag\] \+= 1;/);
});

test('florist achievements are registered', () => {
  assert.match(js, /id: 'autobloom'/);
  assert.match(js, /id: 'bloomworks'/);
});

test('florist is saved and restored with the world', () => {
  assert.match(js, /florists: \[\.\.\.florists\.values\(\)\]/);
  assert.match(js, /savedGame\.florists/);
});

test('controls help documents the florist (desktop and touch)', () => {
  const entries = html.match(/Квітникар/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
