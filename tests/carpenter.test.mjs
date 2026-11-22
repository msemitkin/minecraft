import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('carpenter is wired into every machine guard chain next to mechanics', () => {
  const mecChains = (js.match(/!?mechanics\.has\(/g) || []).length;
  const carChains = (js.match(/!?carpenters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про механіків, має знати і про тесль
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(carChains >= mecChains - 8,
    `carpenters.has: ${carChains}, mechanics.has: ${mecChains}`);
});

test('carpenter ticks with the other machines after the mechanics', () => {
  assert.match(js, /updateMechanics\(dt\);[\s\S]{0,200}updateCarpenters\(dt\);/);
});

test('every explosion records home scars BEFORE the validate sweep', () => {
  // повний запис хатньої речі знімається, поки написи й кінці рейок живі
  assert.match(js,
    /rememberHomeScars\(cx, cy, cz\);[\s\S]{0,400}validateTorches\(\);/);
  // реєстр обмежений: найстарший рубець забувається першим
  assert.match(js, /const HOME_SCARS_MAX = 96;/);
  assert.match(js,
    /while \(homeScars\.size > HOME_SCARS_MAX\) \{\s*\n\s*homeScars\.delete\(homeScars\.keys\(\)\.next\(\)\.value\);/);
  // повторний вибух у тій самій клітинці пам'ятає найпершу річ
  assert.match(js,
    /if \(!homeScars\.has\(key\)\) homeScars\.set\(key, \{ kind, args \}\);/);
  // записуються лише речі, що втратили опору в колі вибуху
  assert.match(js,
    /if \(!lost\(e\)\) continue;[\s\S]{0,300}rememberHomeScar\(/);
});

test('a filled cell heals its home scar inside the shared setBlock', () => {
  assert.match(js, /if \(id !== AIR\) homeScars\.delete\(editKey\);/);
});

test('carpenter restores through the very same addX constructors as the hand', () => {
  // жодного окремого шляху відбудови: make() кличе спільні addX
  assert.match(js, /make: \(x, y, z, a\) => !!addDoor\(x, y, z, a\[0\] \| 0, a\[1\] \| 0, false\)/);
  assert.match(js, /make: \(x, y, z\) => addFence\(x, y, z\)/);
  assert.match(js, /make: \(x, y, z, a\) => addLadder\(x, y, z, a\[0\] \| 0, a\[1\] \| 0\)/);
  // табличка вертається з тим самим написом
  assert.match(js,
    /make: \(x, y, z, a\) => addSign\(x, y, z, \+a\[0\] \|\| 0, String\(a\[1\] \|\| ''\)\)/);
  // рейка вертається з тими самими кінцями, датчиком, жаром чи стрілкою
  assert.match(js,
    /make: \(x, y, z, a\) => addRail\(x, y, z, a\[0\], a\[1\], !!a\[2\], !!a\[3\],\s*\n\s*!!a\[4\], Array\.isArray\(a\[5\]\) \? a\[5\] : null\)/);
  // двері й хвіртки вертаються зачиненими
  assert.match(js, /make: \(x, y, z, a\) => !!addGate\(x, y, z, a\[0\] \| 0, a\[1\] \| 0, false\)/);
});

test('carpenter obeys the shared cell rule and waits for the support (mason first)', () => {
  assert.match(js, /function carpenterScarState\(x, y, z\) \{/);
  assert.match(js,
    /if \(blockAt\(x, y, z\) !== AIR\) return 'gone';\s*\n\s*if \(!fixtureCellFree\(x, y, z\)\) return 'gone';\s*\n\s*if \(!isSolid\(blockAt\(x, y - 1, z\)\)\) return 'wait';\s*\n\s*return 'free';\s*\n\}\s*\n\n\/\/ Що тесля вміє столярити/);
});

test('door and gate never close on a body, the ladder waits for its wall', () => {
  assert.match(js,
    /if \(doorColumnBlockedByEntity\(\{ x, y, z \}\)\) return 'wait';/);
  assert.match(js,
    /if \(gateColumnBlockedByEntity\(\{ x, y, z \}\)\) return 'wait';/);
  // драбина чекає на стіну збоку, а не на підлогу
  assert.match(js,
    /lost: \(e\) => !isSolid\(blockAt\(e\.x \+ e\.dx, e\.y, e\.z \+ e\.dz\)\)/);
  assert.match(js,
    /if \(!isSolid\(blockAt\(x \+ \(a\[0\] \| 0\), y, z \+ \(a\[1\] \| 0\)\)\)\) return 'wait';/);
});

test('carpenter repairs the lowest scar first, nearest among equals, within reach', () => {
  assert.match(js, /const CARPENTER_REACH = 8;/);
  assert.match(js, /function carpenterSpot\(c\)/);
  assert.match(js,
    /function carpenterSpot\(c\) \{[\s\S]{0,900}if \(y < bestY \|\| \(y === bestY && d2 < bestD2\)\) \{/);
});

test('repair is atomic: a taken scar is skipped, a failed make keeps the scar', () => {
  assert.match(js, /function carpenterFinish\(c\)/);
  assert.match(js,
    /if \(st === 'gone'\) \{ homeScars\.delete\(key\); return; \}\s*\n\s*if \(st !== 'free'\) return;/);
  // не вдалося поставити (межа виду) — рубець лежить, де лежав
  assert.match(js,
    /if \(!def\.make\(spot\.x, spot\.y, spot\.z, rec\.args \|\| \[\]\)\) return;\s*\n\s*homeScars\.delete\(key\);/);
  assert.match(js, /c\.joined = \(c\.joined \| 0\) \+ 1;/);
});

test('carpenter waits idle without power', () => {
  assert.match(js, /function carpenterPowered\(c\)/);
  assert.match(js,
    /const on = carpenterPowered\(c\);[\s\S]{0,300}if \(!on\) \{\s*\n\s*c\.joinWorkT = 0;/);
});

test('carpenter achievements are registered', () => {
  assert.match(js, /id: 'autocarp'/);
  assert.match(js, /id: 'joinery'/);
});

test('carpenter and the home scar registry are saved and restored with the world', () => {
  assert.match(js, /carpenters: \[\.\.\.carpenters\.values\(\)\]/);
  assert.match(js,
    /homeScars: \[\.\.\.homeScars\]\.map\(\(\[key, r\]\) => \[key, r\.kind, r\.args\]\)/);
  assert.match(js, /savedGame\.carpenters/);
  assert.match(js, /savedGame\.homeScars/);
  // відновлення перевіряє, що вид речі досі відомий теслі
  assert.match(js,
    /CARPENTER_KINDS\[e\[1\]\] &&\s*\n\s*Array\.isArray\(e\[2\]\)/);
});

test('controls help documents the carpenter (desktop and touch)', () => {
  const entries = html.match(/Тесля/g) || [];
  assert.ok(entries.length >= 2, `«Тесля» згадок у довідці: ${entries.length}`);
});
