import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('tamer is wired into every machine guard chain next to lamplighters', () => {
  const lamChains = (js.match(/!?lamplighters\.has\(/g) || []).length;
  const tamChains = (js.match(/!?tamers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про ліхтарників, має знати і про ловчих
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(tamChains >= lamChains - 8,
    `tamers.has: ${tamChains}, lamplighters.has: ${lamChains}`);
});

test('tamer ticks with the other machines after the lamplighters', () => {
  assert.match(js, /updateLamplighters\(dt\);[\s\S]{0,300}updateTamers\(dt\);/);
});

test('the portion core is shared between the hand and the tamer', () => {
  // спільне серце порції, виділене з feedWolfEntity
  assert.match(js, /function wolfFeedCore\(w\) \{/);
  // рука платить м'ясом з торби і кличе те саме серце
  assert.match(js,
    /function feedWolfEntity\(w\) \{\s*\n\s*if \(player\.food <= 0\) return false;[\s\S]{0,300}player\.food--;\s*\n\s*updateFoodHud\(\);\s*\n\s*wolfFeedCore\(w\);/);
  // ловчий платить м'ясом з полиці і кличе те саме серце
  assert.match(js,
    /function tamerFinish\(t, wolf, chest\) \{[\s\S]{0,600}chest\.store\.food -= 1;\s*\n\s*const tamedNow = wolfFeedCore\(wolf\);/);
});

test('taming chance and the guaranteed third portion live only in the core', () => {
  // жодного окремого шляху приручення: шанс і третя порція — лише в серці
  const chance = js.match(/w\.fedCount >= 3 \|\| Math\.random\(\) < WOLF_TAME_CHANCE/g) || [];
  assert.equal(chance.length, 1);
  // досягнення приручення і тост — теж у спільному серці
  assert.match(js,
    /function wolfFeedCore\(w\) \{[\s\S]{0,900}unlockAch\('tame'\);/);
});

test('while the friend lives the horn is silent', () => {
  // живий приручений вовк — ріжок мовчить (ціль не шукається)
  assert.match(js,
    /function tamerTarget\(t\) \{\s*\n\s*if \(tamerFriendAlive\(\)\) return null;/);
  // і сама мить частування чесно перевіряє ще раз
  assert.match(js,
    /function tamerFinish\(t, wolf, chest\) \{[\s\S]{0,400}if \(tamerFriendAlive\(\)\) return;/);
});

test('the swap is atomic: shelf, wolf and friend are rechecked at the feeding moment', () => {
  assert.match(js,
    /function tamerFinish\(t, wolf, chest\) \{\s*\n\s*if \(\(chest\.store\.food \| 0\) < 1\) return;\s*\n\s*if \(wolf\.tamed \|\| wolf\.health <= 0\) return;/);
});

test('only a wild living wolf within reach is courted', () => {
  assert.match(js, /const TAMER_REACH = 8;/);
  assert.match(js,
    /function tamerWildWolf\(t\) \{[\s\S]{0,300}if \(a\.type !== 'wolf' \|\| a\.tamed \|\| a\.health <= 0\) continue;/);
});

test('meat comes from the fullest chest shelf adjacent (diagonals too)', () => {
  assert.match(js,
    /function tamerMeat\(t\) \{[\s\S]{0,400}Math\.abs\(ch\.x - t\.x\) > 1 \|\| Math\.abs\(ch\.y - t\.y\) > 1 \|\|\s*\n\s*Math\.abs\(ch\.z - t\.z\) > 1/);
  assert.match(js,
    /function tamerMeat\(t\) \{[\s\S]{0,600}const n = ch\.store\.food \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('tamer waits idle without power', () => {
  assert.match(js,
    /const on = tamerPowered\(t\);[\s\S]{0,200}if \(!on\) \{\s*\n\s*t\.feedWorkT = 0;/);
});

test('tamer achievements are registered', () => {
  assert.match(js, /id: 'autotame'/);
  assert.match(js, /id: 'tamepack'/);
  assert.match(js, /const TAMER_PACK_N = 3;/);
  assert.match(js, /if \(t\.tamedN >= TAMER_PACK_N\) unlockAch\('tamepack'\);/);
});

test('tamer counts only completed tamings', () => {
  assert.match(js,
    /if \(tamedNow\) \{\s*\n\s*t\.tamedN = \(t\.tamedN \| 0\) \+ 1;\s*\n\s*unlockAch\('autotame'\);/);
});

test('tamer is saved and restored with the world', () => {
  assert.match(js,
    /tamers: \[\.\.\.tamers\.values\(\)\]\.map\(\(t\) =>\s*\n\s*\[t\.x, t\.y, t\.z, t\.tamedN \| 0\]\)/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.tamers\)\) \{[\s\S]{0,200}addTamer\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('tamer status tooltip and dismantle are wired', () => {
  assert.match(js, /Ловчий: приручено \$\{ti\.tamedN \| 0\}/);
  assert.match(js, /if \(tamers\.has\(key\)\) \{\s*\n\s*breakTamer\(key\);/);
});

test('tamer appears in both control guides and the menu', () => {
  assert.match(html, /🐾 Ловчий \(меню\)/);
  assert.match(html, /🐾 Ловчий \(меню ▤\)/);
  assert.match(js, /\[TAMER\]: 'Ловчий',/);
  assert.match(js, /LAMPLIGHTER, TAMER, HERDER/);
});

test('debug helpers for the tamer exist', () => {
  assert.match(js, /giveTamer: \(\) => \{ assignBlockToSlot\(TAMER\);/);
  assert.match(js, /placeTamerAt: \(x, y, z\) => \{/);
  assert.match(js, /tamerFast: \(\) => \{/);
  assert.match(js, /spawnWildWolfAt: \(x, y, z\) =>/);
  assert.match(js, /get tamerInfo\(\) \{/);
});

test('the mechanic remembers the tamer (iron scar registry)', () => {
  assert.match(js,
    /tamer:\s*\{ map: \(\) => tamers,\s*args: \(e\) => \[e\.tamedN \| 0\],\s*\n\s*make: \(x, y, z, a\) => addTamer\(x, y, z, a\[0\] \| 0\) \},/);
});
