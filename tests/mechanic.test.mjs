import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mechanic is wired into every machine guard chain next to masons', () => {
  const masChains = (js.match(/!?masons\.has\(/g) || []).length;
  const mecChains = (js.match(/!?mechanics\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про мулярів, має знати і про механіків
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(mecChains >= masChains - 8,
    `mechanics.has: ${mecChains}, masons.has: ${masChains}`);
});

test('mechanic ticks with the other machines after the masons', () => {
  assert.match(js, /updateMasons\(dt\);[\s\S]{0,200}updateMechanics\(dt\);/);
});

test('every explosion records machine scars BEFORE the validate sweep', () => {
  // повний запис приладу знімається, поки скрині й ковадла ще в реєстрах
  assert.match(js,
    /rememberMachineScars\(cx, cy, cz\);[\s\S]{0,400}validateTorches\(\);/);
  // реєстр обмежений: найстарший рубець забувається першим
  assert.match(js, /const MACHINE_SCARS_MAX = 96;/);
  assert.match(js,
    /while \(machineScars\.size > MACHINE_SCARS_MAX\) \{\s*\n\s*machineScars\.delete\(machineScars\.keys\(\)\.next\(\)\.value\);/);
  // повторний вибух у тій самій клітинці пам'ятає найперший прилад
  assert.match(js,
    /if \(!machineScars\.has\(key\)\) machineScars\.set\(key, \{ kind, args \}\);/);
  // записуються лише прилади, що втратили опору в колі вибуху
  assert.match(js,
    /if \(isSolid\(blockAt\(e\.x, e\.y - 1, e\.z\)\)\) continue;[\s\S]{0,300}rememberMachineScar\(/);
});

test('a filled cell heals its machine scar inside the shared setBlock', () => {
  assert.match(js, /if \(id !== AIR\) machineScars\.delete\(editKey\);/);
});

test('mechanic restores through the very same addX constructors as the hand', () => {
  // жодного окремого шляху відбудови: make() кличе спільні addX
  assert.match(js, /make: \(x, y, z, a\) => addTurret\(x, y, z, a\[0\] \| 0, a\[1\] \| 0\)/);
  assert.match(js, /make: \(x, y, z\) => addLamp\(x, y, z\)/);
  assert.match(js, /make: \(x, y, z, a\) => addMason\(x, y, z, a\[0\] \| 0\)/);
  // механік лагодить і побратима-механіка
  assert.match(js, /mechanic:\s*\{ map: \(\) => mechanics/);
  // скриня вертається з усіма полицями
  assert.match(js,
    /\[Object\.entries\(e\.store\)\.filter\(\(\[, n\]\) => n > 0\)\]/);
  // поршень лагодиться втягнутим
  assert.match(js,
    /addPiston\(x, y, z, a\[0\] \| 0, a\[1\] \| 0, false, !!a\[2\]\)/);
});

test('mechanic obeys the shared cell rule and waits for the support (mason first)', () => {
  assert.match(js, /function mechanicScarState\(x, y, z\) \{/);
  assert.match(js,
    /if \(blockAt\(x, y, z\) !== AIR\) return 'gone';\s*\n\s*if \(!fixtureCellFree\(x, y, z\)\) return 'gone';\s*\n\s*if \(!isSolid\(blockAt\(x, y - 1, z\)\)\) return 'wait';\s*\n\s*return 'free';/);
});

test('mechanic repairs the lowest scar first, nearest among equals, within reach', () => {
  assert.match(js, /const MECHANIC_REACH = 8;/);
  assert.match(js, /function mechanicSpot\(m\)/);
  assert.match(js,
    /function mechanicSpot\(m\) \{[\s\S]{0,900}if \(y < bestY \|\| \(y === bestY && d2 < bestD2\)\) \{/);
});

test('repair is atomic: a taken scar is skipped, a failed make keeps the scar', () => {
  assert.match(js, /function mechanicFinish\(m\)/);
  assert.match(js,
    /if \(st === 'gone'\) \{ machineScars\.delete\(key\); return; \}\s*\n\s*if \(st !== 'free'\) return;/);
  // не вдалося поставити (межа виду) — рубець лежить, де лежав
  assert.match(js,
    /if \(!def\.make\(spot\.x, spot\.y, spot\.z, rec\.args \|\| \[\]\)\) return;\s*\n\s*machineScars\.delete\(key\);/);
  assert.match(js, /m\.fixed = \(m\.fixed \| 0\) \+ 1;/);
});

test('mechanic waits idle without power', () => {
  assert.match(js, /function mechanicPowered\(m\)/);
  assert.match(js,
    /const on = mechanicPowered\(m\);[\s\S]{0,300}if \(!on\) \{\s*\n\s*m\.fixWorkT = 0;/);
});

test('mechanic achievements are registered', () => {
  assert.match(js, /id: 'automech'/);
  assert.match(js, /id: 'workshop'/);
});

test('mechanic and the machine scar registry are saved and restored with the world', () => {
  assert.match(js, /mechanics: \[\.\.\.mechanics\.values\(\)\]/);
  assert.match(js,
    /machineScars: \[\.\.\.machineScars\]\.map\(\(\[key, r\]\) => \[key, r\.kind, r\.args\]\)/);
  assert.match(js, /savedGame\.mechanics/);
  assert.match(js, /savedGame\.machineScars/);
  // відновлення перевіряє, що вид приладу досі відомий механіку
  assert.match(js,
    /MECHANIC_KINDS\[e\[1\]\] &&\s*\n\s*Array\.isArray\(e\[2\]\)/);
});

test('controls help documents the mechanic (desktop and touch)', () => {
  const entries = html.match(/Механік/g) || [];
  assert.ok(entries.length >= 2, `«Механік» згадок у довідці: ${entries.length}`);
});
