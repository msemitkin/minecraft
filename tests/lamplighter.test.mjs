import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('lamplighter is wired into every machine guard chain next to carpenters', () => {
  const carChains = (js.match(/!?carpenters\.has\(/g) || []).length;
  const lamChains = (js.match(/!?lamplighters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про тесль, має знати і про ліхтарників
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(lamChains >= carChains - 8,
    `lamplighters.has: ${lamChains}, carpenters.has: ${carChains}`);
});

test('lamplighter ticks with the other machines after the carpenters', () => {
  assert.match(js, /updateCarpenters\(dt\);[\s\S]{0,200}updateLamplighters\(dt\);/);
});

test('lamplighter lights through the very same addTorch as the hand', () => {
  // жодного окремого шляху засвічування: finish кличе спільний addTorch
  assert.match(js,
    /function lamplighterFinish\(l\) \{[\s\S]{0,600}addTorch\(spot\.x, spot\.y, spot\.z, 'floor'\)/);
  // рука світить тим самим addTorch
  assert.match(js, /ok = addTorch\(x, y, z, 'floor'\);/);
});

test('the torch cell rule is shared between the hand and the lamplighter', () => {
  // спільне правило клітинки, виділене з placeTorch
  assert.match(js, /function torchCellFree\(x, y, z\) \{/);
  assert.match(js,
    /function placeTorch\(hit\) \{\s*\n\s*const \[x, y, z\] = hit\.prev;\s*\n\s*if \(!torchCellFree\(x, y, z\)\) return false;/);
  assert.match(js,
    /function lamplighterDarkAt\(x, h, z\) \{[\s\S]{0,900}return torchCellFree\(x, h \+ 1, z\);/);
  // правило знає і про муляра, механіка, теслю та ліхтарника
  assert.match(js, /masons\.has\(torchKey\(x, y, z\)\) \|\| mechanics\.has\(torchKey\(x, y, z\)\) \|\|\s*\n\s*carpenters\.has\(torchKey\(x, y, z\)\) \|\|\s*\n\s*lamplighters\.has\(torchKey\(x, y, z\)\)/);
});

test('a dark spot is exactly where a mob could spawn on an ordinary night', () => {
  // ті самі перевірки, що в trySpawnMob: не пляж, тверда опора, два повітря
  assert.match(js,
    /function lamplighterDarkAt\(x, h, z\) \{\s*\n\s*if \(h <= SEA \+ 1\) return false;[\s\S]{0,200}if \(!isSolid\(blockAt\(x, h, z\)\)\) return false;[\s\S]{0,200}isSolid\(blockAt\(x, h \+ 2, z\)\)\) return false;/);
  // і всі вогні двору з їхніми звичайними нічними радіусами
  assert.match(js, /const LAMPLIGHTER_GUARD_R = 7;/);
  assert.match(js,
    /torchNear\(cx, cy, cz, LAMPLIGHTER_GUARD_R\)[\s\S]{0,300}campfireNear\(cx, cy, cz, LAMPLIGHTER_GUARD_R\)[\s\S]{0,300}jackNear\(cx, cy, cz, JACK_GUARD_R\)[\s\S]{0,300}starNear\(cx, cy, cz, STAR_GUARD_R\)[\s\S]{0,300}lampNear\(cx, cy, cz, LAMP_GUARD_R\)/);
  // trySpawnMob досі міряє тими самими радіусами
  assert.match(js, /const guardR = bloodNight \? BLOOD_GUARD_R : 7;/);
});

test('lamplighter picks the nearest dark spot within reach', () => {
  assert.match(js, /const LAMPLIGHTER_REACH = 10;/);
  assert.match(js,
    /function lamplighterSpot\(l\) \{[\s\S]{0,700}if \(d2 > r2 \|\| d2 >= bestD2\) continue;/);
});

test('lighting is atomic: a brightened spot is skipped, a full world keeps waiting', () => {
  // місце перевіряється знову в мить засвічування
  assert.match(js,
    /const spot = l\.spot;\s*\n\s*l\.spot = null;\s*\n\s*if \(!spot\) return;\s*\n\s*if \(!lamplighterDarkAt\(spot\.x, spot\.y - 1, spot\.z\)\) return;\s*\n\s*if \(!addTorch\(spot\.x, spot\.y, spot\.z, 'floor'\)\) return;/);
  // знайдене місце, що посвітлішало, чесно скидається щотику
  assert.match(js,
    /if \(l\.spot && !lamplighterDarkAt\(l\.spot\.x, l\.spot\.y - 1, l\.spot\.z\)\) \{\s*\n\s*l\.spot = null;/);
});

test('lamplighter waits idle without power', () => {
  assert.match(js,
    /if \(!on\) \{\s*\n\s*l\.lightWorkT = 0;\s*\n\s*l\.scanT = 0;\s*\n\s*l\.spot = null;/);
});

test('lamplighter achievements are registered', () => {
  assert.match(js, /id: 'autolight'/);
  assert.match(js, /id: 'lamplight'/);
  assert.match(js, /const LAMPLIGHTER_LIT_N = 8;/);
  assert.match(js, /if \(l\.lit >= LAMPLIGHTER_LIT_N\) unlockAch\('lamplight'\);/);
});

test('lamplighter is saved and restored with the world', () => {
  assert.match(js,
    /lamplighters: \[\.\.\.lamplighters\.values\(\)\]\.map\(\(l\) =>\s*\n\s*\[l\.x, l\.y, l\.z, l\.lit \| 0\]\),/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.lamplighters\)\) \{[\s\S]{0,300}addLamplighter\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('the mechanic remembers the lamplighter and the carpenter among its kinds', () => {
  // вибух, що валить ліхтарника чи теслю, лишає залізний рубець
  assert.match(js,
    /carpenter: {3}\{ map: \(\) => carpenters, {3}args: \(e\) => \[e\.joined \| 0\],\s*\n\s*make: \(x, y, z, a\) => addCarpenter\(x, y, z, a\[0\] \| 0\) \},/);
  assert.match(js,
    /lamplighter: \{ map: \(\) => lamplighters, args: \(e\) => \[e\.lit \| 0\],\s*\n\s*make: \(x, y, z, a\) => addLamplighter\(x, y, z, a\[0\] \| 0\) \},/);
});

test('controls help documents the lamplighter (desktop and touch)', () => {
  assert.match(html, /🏮 Ліхтарник \(меню\)/);
  assert.match(html, /🏮 Ліхтарник \(меню ▤\)/);
  assert.match(html, /тим самим смолоскипом, що й рука/);
});
