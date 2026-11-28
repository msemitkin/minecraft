import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('carver is wired into every machine guard chain next to cheesemakers', () => {
  const chmChains = (js.match(/!?cheesemakers\.has\(/g) || []).length;
  const crvChains = (js.match(/!?carvers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про сироварів, має знати і про різьбярів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(crvChains >= chmChains - 8,
    `carvers.has: ${crvChains}, cheesemakers.has: ${chmChains}`);
});

test('carver ticks with the other machines after the cheesemakers', () => {
  assert.match(js, /updateCheesemakers\(dt\);[\s\S]{0,300}updateCarvers\(dt\);/);
});

test('carver carves through the very same carvePumpkin as the hand', () => {
  // жодного окремого шляху різьблення: finish кличе спільний carvePumpkin
  assert.match(js,
    /function carverFinish\(c\) \{[\s\S]{0,400}carvePumpkin\(spot\.x, spot\.y, spot\.z\);/);
  // рука різьбить тим самим carvePumpkin (ПКМ по гарбузу)
  assert.match(js,
    /if \(blockAt\(hit\.block\[0\], hit\.block\[1\], hit\.block\[2\]\) === PUMPKIN\) \{\s*\n\s*carvePumpkin\(hit\.block\[0\], hit\.block\[1\], hit\.block\[2\]\);/);
  // ліхтар Джека встає лише в серці різьблення: setBlock(..., JACK) один
  const uses = (js.match(/setBlock\(x, y, z, JACK\);/g) || []).length;
  assert.equal(uses, 1, `setBlock(..., JACK) згадок: ${uses}`);
  // і те саме досягнення різьбяра живе в серці, а не в руці
  assert.match(js,
    /function carvePumpkin\(x, y, z\) \{[\s\S]{0,400}unlockAch\('carve'\);/);
});

test('carver picks the nearest whole pumpkin within reach', () => {
  assert.match(js, /const CARVER_REACH = 6;/);
  assert.match(js,
    /function carverSpot\(c\) \{[\s\S]{0,700}if \(d2 > r2 \|\| d2 >= bestD2\) continue;[\s\S]{0,200}if \(blockAt\(x, y, z\) !== PUMPKIN\) continue;/);
});

test('carving is atomic: a vanished or already-carved pumpkin is skipped', () => {
  // гарбуз перевіряється знову в мить різьблення
  assert.match(js,
    /const spot = c\.spot;\s*\n\s*c\.spot = null;\s*\n\s*if \(!spot\) return;\s*\n\s*if \(blockAt\(spot\.x, spot\.y, spot\.z\) !== PUMPKIN\) return;/);
  // знайдений гарбуз, що зник чи вже став ліхтарем, чесно скидається щотику
  assert.match(js,
    /if \(c\.spot && blockAt\(c\.spot\.x, c\.spot\.y, c\.spot\.z\) !== PUMPKIN\) \{\s*\n\s*c\.spot = null;/);
});

test('carver waits idle without power or pumpkins', () => {
  assert.match(js,
    /if \(!on\) \{\s*\n\s*c\.carveWorkT = 0;\s*\n\s*c\.scanT = 0;\s*\n\s*c\.spot = null;/);
  assert.match(js,
    /if \(!c\.spot\) \{ {2}\/\/ цілих гарбузів у сягу нема — ніж спочиває/);
});

test('the lamplighter honestly shares the night with the carver', () => {
  // ліхтарник бачить ліхтар Джека як світло двору і мовчить там,
  // де вже світить гарбуз різьбяра
  assert.match(js,
    /function lamplighterDarkAt\(x, h, z\) \{[\s\S]{0,700}jackNear\(cx, cy, cz, JACK_GUARD_R\)/);
});

test('carver achievements are registered', () => {
  assert.match(js, /id: 'autocarve'/);
  assert.match(js, /id: 'jackstreet'/);
  assert.match(js, /const CARVER_JACKS_N = 8;/);
  assert.match(js, /if \(c\.carved >= CARVER_JACKS_N\) unlockAch\('jackstreet'\);/);
});

test('carver is saved and restored with the world', () => {
  assert.match(js,
    /carvers: \[\.\.\.carvers\.values\(\)\]\.map\(\(c\) =>\s*\n\s*\[c\.x, c\.y, c\.z, c\.carved \| 0\]\),/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.carvers\)\) \{[\s\S]{0,300}addCarver\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('the mechanic remembers the carver and the cheesemaker among its kinds', () => {
  // вибух, що валить різьбяра чи сировара, лишає залізний рубець
  assert.match(js,
    /cheesemaker: \{ map: \(\) => cheesemakers, args: \(e\) => \[e\.pressed \| 0\],\s*\n\s*make: \(x, y, z, a\) => addCheesemaker\(x, y, z, a\[0\] \| 0\) \},/);
  assert.match(js,
    /carver: {6}\{ map: \(\) => carvers, {6}args: \(e\) => \[e\.carved \| 0\],\s*\n\s*make: \(x, y, z, a\) => addCarver\(x, y, z, a\[0\] \| 0\) \},/);
});

test('carver appears in both control guides and the menu', () => {
  assert.match(html, /🎃 Різьбяр \(меню\)/);
  assert.match(html, /🎃 Різьбяр \(меню ▤\)/);
  assert.match(html, /тим самим різьбленням, що й рука/);
  assert.match(js, /TAMER, HERDER, STABLER, CHEESEMAKER, CARVER, OBSERVER/);
  assert.match(js, /\[CARVER\]: 'Різьбяр',/);
});
