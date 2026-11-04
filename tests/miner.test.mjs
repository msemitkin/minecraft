import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('miner is wired into every machine guard chain next to milkmaids', () => {
  const mlkChains = (js.match(/!?milkmaids\.has\(/g) || []).length;
  const mnrChains = (js.match(/!?miners\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про доярок, має знати і про рудокопок
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(mnrChains >= mlkChains - 8,
    `miners.has: ${mnrChains}, milkmaids.has: ${mlkChains}`);
});

test('miner ticks with the other machines after the milkmaids', () => {
  assert.match(js, /updateMilkmaids\(dt\);[\s\S]{0,400}updateMiners\(dt\);/);
});

test('miner digs only a real vein from the world, never menu-placed ore', () => {
  // ставлена з меню руда — бутафорія: кайло звіряється з edits, як рука
  assert.match(js, /if \(edits\.get\(minerKey\(x, y, z\)\) === id\) continue;/);
  // сяг рудокопки обмежений по горизонталі й вертикалі
  assert.match(js, /const MINER_REACH = 2;/);
  assert.match(js, /dy = -MINER_DY_DOWN; dy <= MINER_DY_UP;/);
  // клітинка тумби й опора під нею недоторканні
  assert.match(js, /if \(dx === 0 && dz === 0 && dy <= 0\) continue;/);
});

test('miner picks the most precious vein, nearest among equals', () => {
  assert.match(js, /const MINER_ORE_RANK = \{ coal: 0, iron: 1, gold: 2, diam: 3 \};/);
  assert.match(js, /MINER_ORE_RANK\[kind\] \* 1000 - \(dx \* dx \+ dy \* dy \+ dz \* dz\)/);
});

test('ore lands on the fullest not-yet-full shelf beside the miner', () => {
  // серед скринь впритул — найповніша (та ще не повна) полиця цієї руди
  assert.match(js, /function minerChest\(m, kind\) \{\s*\n\s*let best = null, bestN = -1;/);
  assert.match(js, /if \(n < CHEST_STACK && n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('mining is atomic and leaves bare stone, no hole in the wall', () => {
  // руда сходить зі стіни і лягає на полицю одним обміном у minerFinish;
  // жила, що зникла по дорозі, не дає нічого
  assert.match(js, /function minerFinish\(m, vein\)/);
  assert.match(js, /if \(!chest \|\| blockAt\(vein\.x, vein\.y, vein\.z\) !== vein\.id\) return;/);
  assert.match(js, /setBlock\(vein\.x, vein\.y, vein\.z, STONE\);\s*\n\s*chest\.store\[vein\.kind\] = Math\.min\(CHEST_STACK, \(chest\.store\[vein\.kind\] \| 0\) \+ 1\);/);
  assert.match(js, /m\.mined = \(m\.mined \| 0\) \+ 1;/);
});

test('hand path stays: ore is still mined by hand into the bag', () => {
  // руда, як і раніше, б'ється вручну в торбу (і той самий захист від
  // «постав-вибий» лишається на місці)
  assert.match(js, /const oreFromWorld = ORE_OF_BLOCK_ID\[id\] && edits\.get\(key\) !== id;/);
});

test('miner achievements are registered', () => {
  assert.match(js, /id: 'autoore'/);
  assert.match(js, /id: 'minehall'/);
});

test('miner is saved and restored with the world', () => {
  assert.match(js, /miners: \[\.\.\.miners\.values\(\)\]/);
  assert.match(js, /savedGame\.miners/);
});

test('controls help documents the miner (desktop and touch)', () => {
  const entries = html.match(/Рудокопка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
