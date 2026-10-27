import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('weaver is wired into every machine guard chain next to dyehouses', () => {
  const dyehouseChains = (js.match(/!?dyehouses\.has\(/g) || []).length;
  const weaverChains = (js.match(/!?weavers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про фарбувальні, має знати і про ткаль
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(weaverChains >= dyehouseChains - 8,
    `weavers.has: ${weaverChains}, dyehouses.has: ${dyehouseChains}`);
});

test('weaver ticks with the other machines after the dyehouses', () => {
  assert.match(js, /updateDyehouses\(dt\);[\s\S]{0,400}updateWeavers\(dt\);/);
});

test('weaver needs a free supported cell in reach and a chest with yarn', () => {
  // сяг ткалі обмежений по горизонталі й вертикалі
  assert.match(js, /WEAVER_REACH_Y/);
  // тче лише у вільну клітинку з твердою опорою (перевірка поршня + опора)
  assert.match(js, /if \(!pistonDestFree\(x, y, z\)\) continue;/);
  assert.match(js, /isSolid\(blockAt\(x, y - 1, z\)\)\) continue;\s*\/\/ тче лише на опору/);
  // без клітинки чи рун — човник чекає впорожні
  assert.match(js, /const found = weaverTarget\(w\);/);
  // на блок іде WEAVER_YARN_PER_BLOCK рун із найповнішої полиці
  assert.match(js, /bestN >= WEAVER_YARN_PER_BLOCK \? best : null;/);
});

test('weaver never weaves into the player', () => {
  assert.match(js, /\/\/ Не ткати всередину гравця/);
  assert.match(js, /y \+ 1 > p\.y && y < p\.y \+ PLAYER_H &&\s*\n\s*z \+ 1 > p\.z - PLAYER_W && z < p\.z \+ PLAYER_W\) continue;/);
});

test('weaving is atomic at the moment of finishing (nothing to lose)', () => {
  // руна сходять з полиці і блок виростає всередині weaverFinish —
  // зламана ткаля нічого не губить
  assert.match(js, /function weaverFinish\(w, spot, chest\)/);
  assert.match(js, /chest\.store\.wool -= WEAVER_YARN_PER_BLOCK;\s*\n\s*setBlock\(spot\[0\], spot\[1\], spot\[2\], WOOL\);/);
  assert.match(js, /w\.woven = \(w\.woven \| 0\) \+ 1;/);
});

test('hand path stays: the wool block is still placed from the menu', () => {
  // блок вовни лишається в меню Tab — рука нікуди не дівається
  assert.match(js, /GRASS, DIRT, STONE, SAND, GRAVEL, SNOW, LOG, LEAVES, PLANK, GLASS, WOOL,/);
});

test('weaver closes the wool loop with the shearer and the dyehouse', () => {
  // стригаль кладе руна на полицю 'wool' — ткаля бере з тієї самої полиці
  assert.match(js, /const n = ch\.store\.wool \| 0;/);
  // зіткане — та сама кремова вовна WOOL, яку бачить фарбувальня
  assert.match(js, /blockAt\(x, y, z\) !== WOOL\) continue;/);
});

test('weaver achievements are registered', () => {
  assert.match(js, /id: 'autoweave'/);
  assert.match(js, /id: 'weaveworks'/);
});

test('weaver is saved and restored with the world', () => {
  assert.match(js, /weavers: \[\.\.\.weavers\.values\(\)\]/);
  assert.match(js, /savedGame\.weavers/);
});

test('controls help documents the weaver (desktop and touch)', () => {
  const entries = html.match(/Ткаля/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
