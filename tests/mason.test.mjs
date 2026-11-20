import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mason is wired into every machine guard chain next to sculptors', () => {
  const scuChains = (js.match(/!?sculptors\.has\(/g) || []).length;
  const masChains = (js.match(/!?masons\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про ліпників, має знати і про мулярів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(masChains >= scuChains - 8,
    `masons.has: ${masChains}, sculptors.has: ${scuChains}`);
});

test('mason ticks with the other machines after the sculptors', () => {
  assert.match(js, /updateSculptors\(dt\);[\s\S]{0,400}updateMasons\(dt\);/);
});

test('every explosion records blast scars: cell -> the block that stood there', () => {
  // рубець записується в мить вибуху, до setBlock(AIR); лава не мурується
  assert.match(js,
    /if \(id !== LAVA\) rememberBlastScar\(x, y, z, id\);\s*\n\s*setBlock\(x, y, z, AIR\);/);
  // реєстр обмежений: найстарший рубець забувається першим
  assert.match(js, /const BLAST_SCARS_MAX = 192;/);
  assert.match(js,
    /while \(blastScars\.size > BLAST_SCARS_MAX\) \{\s*\n\s*blastScars\.delete\(blastScars\.keys\(\)\.next\(\)\.value\);/);
  // повторний вибух у тій самій клітинці пам'ятає найперший блок
  assert.match(js, /if \(!blastScars\.has\(key\)\) blastScars\.set\(key, id\);/);
});

test('a filled cell heals its scar inside the shared setBlock (atomic laying)', () => {
  // заповнена будь-чим клітинка випадає з реєстру в самому setBlock
  assert.match(js, /if \(id !== AIR\) blastScars\.delete\(editKey\);/);
  // кладка: setBlock того самого id, що стояв до вибуху
  assert.match(js,
    /const id = blastScars\.get\(key\);[\s\S]{0,400}setBlock\(spot\.x, spot\.y, spot\.z, id\);/);
});

test('mason obeys the shared cell rules (fixtureCellFree + sculptorCellBodyFree)', () => {
  assert.match(js, /function masonScarState\(x, y, z\) \{/);
  assert.match(js,
    /if \(blockAt\(x, y, z\) !== AIR\) return 'gone';\s*\n\s*if \(!fixtureCellFree\(x, y, z\)\) return 'gone';\s*\n\s*if \(!sculptorCellBodyFree\(x, y, z\)\) return 'wait';\s*\n\s*return 'free';/);
});

test('mason lays the lowest scar first, nearest among equals, within reach', () => {
  assert.match(js, /const MASON_REACH = 8;/);
  assert.match(js, /function masonSpot\(m\)/);
  assert.match(js,
    /if \(y < bestY \|\| \(y === bestY && d2 < bestD2\)\) \{/);
});

test('laying is atomic: a healed or taken scar is skipped, nothing is lost', () => {
  assert.match(js, /function masonFinish\(m\)/);
  assert.match(js,
    /if \(st === 'gone'\) \{ blastScars\.delete\(key\); return; \}\s*\n\s*if \(st !== 'free'\) return;/);
  assert.match(js, /m\.laid = \(m\.laid \| 0\) \+ 1;/);
});

test('mason never walls a body in: it shares the sculptor body rule and waits', () => {
  // спільна перевірка тіла в клітинці — та сама, що в ліпника
  const defs = (js.match(/function sculptorCellBodyFree\(/g) || []).length;
  assert.equal(defs, 1, 'sculptorCellBodyFree має бути визначена рівно раз');
  // тіло всередині — 'wait': рубець чекає, не забувається
  assert.match(js,
    /if \(m\.spot && masonScarState\(m\.spot\.x, m\.spot\.y, m\.spot\.z\) !== 'free'\) \{\s*\n\s*m\.spot = null;/);
});

test('mason waits idle without power', () => {
  assert.match(js, /function masonPowered\(m\)/);
  assert.match(js,
    /const on = masonPowered\(m\);[\s\S]{0,300}if \(!on\) \{\s*\n\s*m\.layWorkT = 0;/);
});

test('mason achievements are registered', () => {
  assert.match(js, /id: 'automason'/);
  assert.match(js, /id: 'rebuild'/);
});

test('mason and the scar registry are saved and restored with the world', () => {
  assert.match(js, /masons: \[\.\.\.masons\.values\(\)\]/);
  assert.match(js, /blastScars: \[\.\.\.blastScars\]/);
  assert.match(js, /savedGame\.masons/);
  assert.match(js, /savedGame\.blastScars/);
});

test('controls help documents the mason (desktop and touch)', () => {
  const entries = html.match(/Муляр/g) || [];
  assert.ok(entries.length >= 2, `«Муляр» згадок у довідці: ${entries.length}`);
});
