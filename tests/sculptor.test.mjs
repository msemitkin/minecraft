import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('sculptor is wired into every machine guard chain next to smiths', () => {
  const smtChains = (js.match(/!?smiths\.has\(/g) || []).length;
  const scuChains = (js.match(/!?sculptors\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про ковалів, має знати і про ліпників
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(scuChains >= smtChains - 8,
    `sculptors.has: ${scuChains}, smiths.has: ${smtChains}`);
});

test('sculptor ticks with the other machines after the smiths', () => {
  assert.match(js, /updateSmiths\(dt\);[\s\S]{0,400}updateSculptors\(dt\);/);
});

test('sculptor builds the guard by the very same move as the hand (shared tryFormGolem)', () => {
  // оживлення сніговика визначене рівно раз — спільний шлях руки й машини
  const defs = (js.match(/function tryFormGolem\(/g) || []).length;
  assert.equal(defs, 1, 'tryFormGolem має бути визначений рівно раз');
  // рука: гравій поверх двох блоків снігу оживає тим самим ходом
  assert.match(js, /if \(id === GRAVEL\) tryFormGolem\(x, y, z\);/);
  // ліпник: колона сніг+сніг+гравій і той самий tryFormGolem
  assert.match(js,
    /setBlock\(spot\.x, spot\.y, spot\.z, SNOW\);\s*\n\s*setBlock\(spot\.x, spot\.y \+ 1, spot\.z, SNOW\);\s*\n\s*setBlock\(spot\.x, spot\.y \+ 2, spot\.z, GRAVEL\);\s*\n\s*if \(!tryFormGolem\(spot\.x, spot\.y \+ 2, spot\.z\)\) return;/);
});

test('sculptor column obeys the shared machine cell rule (fixtureCellFree)', () => {
  // спільне правило клітинки: видобуте з powerCellFree, одне на всіх
  assert.match(js, /function fixtureCellFree\(x, y, z\)/);
  assert.match(js,
    /function powerCellFree\(x, y, z\) \{\s*\n\s*return fixtureCellFree\(x, y, z\) && isSolid\(blockAt\(x, y - 1, z\)\);/);
  // колона: тверда опора, три вільні клітинки і без тіла всередині
  assert.match(js, /function sculptorColumnFree\(x, y, z\)/);
  assert.match(js,
    /for \(let dy = 0; dy < 3; dy\+\+\) \{\s*\n\s*if \(!fixtureCellFree\(x, y \+ dy, z\)\) return false;\s*\n\s*if \(!sculptorCellBodyFree\(x, y \+ dy, z\)\) return false;/);
});

test('sculptor builds on a ring and waits idle while the guard stands', () => {
  // кільце 2–3 блоки від тумби, ±1 по вертикалі
  assert.match(js, /const SCULPTOR_NEAR = 2;/);
  assert.match(js, /const SCULPTOR_REACH = 3;/);
  assert.match(js, /if \(Math\.max\(Math\.abs\(dx\), Math\.abs\(dz\)\) < SCULPTOR_NEAR\) continue;/);
  // поки в колі варти живе сніговик — кельма спочиває
  assert.match(js, /const SCULPTOR_GUARD_R = 10;/);
  assert.match(js, /function sculptorGuard\(s\)/);
  assert.match(js,
    /if \(sculptorGuard\(s\)\) \{\s*\n\s*s\.buildWorkT = 0;\s*\n\s*s\.spot = null;/);
  // найближче місце перше
  assert.match(js, /const score = -\(dx \* dx \+ dz \* dz\) \* 100 \+ dy;[\s\S]{0,900}function sculptorFinish/);
});

test('sculpting is atomic: an occupied spot is skipped, nothing is lost', () => {
  // місце перевіряється ще раз у мить ліплення; зайняте — пропускається
  assert.match(js, /function sculptorFinish\(s\)/);
  assert.match(js, /if \(!spot \|\| !sculptorColumnFree\(spot\.x, spot\.y, spot\.z\)\) return;/);
  assert.match(js, /s\.sculpted = \(s\.sculpted \| 0\) \+ 1;/);
});

test('sculptor never walls a body in: player, animal or mob in the column cells blocks it', () => {
  assert.match(js, /function sculptorCellBodyFree\(x, y, z\)/);
  assert.match(js, /if \(!player\.dead &&[\s\S]{0,200}return false;/);
  assert.match(js, /for \(const a of animals\) \{[\s\S]{0,250}a\.height[\s\S]{0,80}return false;/);
  assert.match(js, /for \(const m of mobs\) \{[\s\S]{0,250}return false;/);
});

test('sculptor waits idle without power', () => {
  assert.match(js, /function sculptorPowered\(s\)/);
  assert.match(js,
    /const on = sculptorPowered\(s\);[\s\S]{0,300}if \(!on\) \{\s*\n\s*s\.buildWorkT = 0;/);
});

test('hand-built snowman column stays (snow+snow+gravel by RMB)', () => {
  assert.match(js, /function tryFormGolem\(x, y, z\) \{\s*\n\s*if \(blockAt\(x, y, z\) !== GRAVEL\) return false;/);
  assert.match(js, /if \(blockAt\(x, y - 1, z\) !== SNOW \|\| blockAt\(x, y - 2, z\) !== SNOW\) return false;/);
});

test('sculptor achievements are registered', () => {
  assert.match(js, /id: 'autogolem'/);
  assert.match(js, /id: 'snowpost'/);
});

test('sculptor is saved and restored with the world', () => {
  assert.match(js, /sculptors: \[\.\.\.sculptors\.values\(\)\]/);
  assert.match(js, /savedGame\.sculptors/);
});

test('controls help documents the sculptor (desktop and touch)', () => {
  const entries = html.match(/Ліпник/g) || [];
  assert.ok(entries.length >= 2, `«Ліпник» згадок у довідці: ${entries.length}`);
});
