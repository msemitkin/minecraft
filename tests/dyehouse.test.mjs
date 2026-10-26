import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('dyehouse is wired into every machine guard chain next to florists', () => {
  const floristChains = (js.match(/!?florists\.has\(/g) || []).length;
  const dyehouseChains = (js.match(/!?dyehouses\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про квітникарі, має знати і про фарбувальні
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(dyehouseChains >= floristChains - 8,
    `dyehouses.has: ${dyehouseChains}, florists.has: ${floristChains}`);
});

test('dyehouse ticks with the other machines after the florists', () => {
  assert.match(js, /updateFlorists\(dt\);[\s\S]{0,400}updateDyehouses\(dt\);/);
});

test('dyehouse needs creamy wool in reach and a chest with a flower on a shelf', () => {
  // сяг фарбувальні обмежений по горизонталі й вертикалі
  assert.match(js, /DYEHOUSE_REACH_Y/);
  // чан бачить лише кремову вовну — фарбована недоторканна
  assert.match(js, /blockAt\(x, y, z\) !== WOOL\) continue;/);
  // без вовни чи квітки — квач чекає впорожні
  assert.match(js, /const found = dyehouseTarget\(d\);/);
  // колір обирає найповніша полиця (рівний запас — порядок мак → кульбаба → волошка)
  assert.match(js, /if \(n > bestN\) \{ bestN = n; bestChest = ch; bestKind = i; \}/);
});

test('dyehouse paints only creamy wool, dyed wool stays for the hand', () => {
  // машина шукає саме WOOL, а не isWoolBlock — перефарбування лишається рукам
  assert.match(js, /function dyehouseWool\(d\)/);
  const machineChecks = (js.match(/!== WOOL\) continue;/g) || []).length;
  assert.ok(machineChecks >= 1, `знайдено ${machineChecks} перевірок кремової вовни`);
});

test('dyehouse paint is atomic at the moment of dyeing (nothing to lose)', () => {
  // квітка сходить з полиці і блок убирається в колір всередині
  // dyehouseFinish — зламана фарбувальня нічого не губить
  assert.match(js, /function dyehouseFinish\(d, wool, chest, kindIdx\)/);
  assert.match(js, /chest\.store\[kind\.bag\] -= 1;\s*\n\s*setBlock\(wool\[0\], wool\[1\], wool\[2\], kind\.wool\);/);
  assert.match(js, /d\.painted = \(d\.painted \| 0\) \+ 1;/);
});

test('hand path stays: wool is still dyed by hand with a flower from the bag', () => {
  // ПКМ-фарбування з торби нікуди не дівається
  assert.match(js, /function useFlower\(hit, id\)/);
  assert.match(js, /setBlock\(bx, by, bz, kind\.wool\);/);
});

test('dyehouse achievements are registered', () => {
  assert.match(js, /id: 'autodye'/);
  assert.match(js, /id: 'dyeworks'/);
});

test('dyehouse is saved and restored with the world', () => {
  assert.match(js, /dyehouses: \[\.\.\.dyehouses\.values\(\)\]/);
  assert.match(js, /savedGame\.dyehouses/);
});

test('controls help documents the dyehouse (desktop and touch)', () => {
  const entries = html.match(/Фарбувальня/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
