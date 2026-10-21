import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('dredge is wired into every machine guard chain next to dryers', () => {
  const dryerChains = (js.match(/!?dryers\.has\(/g) || []).length;
  const dredgeChains = (js.match(/!?dredges\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про сушарки, має знати і про драги
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(dredgeChains >= dryerChains - 8,
    `dredges.has: ${dredgeChains}, dryers.has: ${dryerChains}`);
});

test('dredge ticks with the other machines after the dryers', () => {
  assert.match(js, /updateDryers\(dt\);[\s\S]{0,400}updateDredges\(dt\);/);
});

test('dredge needs an oyster on the seabed within reach and a chest with shelf space', () => {
  // устриця береться лише в сягу: по горизонталі й у глиб
  assert.match(js, /Math\.abs\(o\.x - d\.x\) > DREDGE_REACH/);
  assert.match(js, /o\.y > d\.y \+ 1 \|\| o\.y < d\.y - DREDGE_DEPTH/);
  // скриня впритул береться лише з місцем на полиці устриць
  assert.match(js, /\(ch\.store\.oyster \| 0\) < CHEST_STACK/);
  // без скрині — черпак чекає впорожні
  assert.match(js, /const chest = dredgeChest\(d\);/);
});

test('dredge pull is atomic at the moment of readiness (nothing to lose)', () => {
  // устриця зникає зі світу і лягає на полицю всередині dredgeFinish —
  // зламана драга нічого не губить
  assert.match(js, /function dredgeFinish\(d, chest, oKey, o\)/);
  assert.match(js, /removeOyster\(oKey\);\s*\n\s*chest\.store\.oyster = Math\.min\(CHEST_STACK, \(chest\.store\.oyster \| 0\) \+ 1\);/);
  assert.match(js, /d\.pulled = \(d\.pulled \| 0\) \+ 1;/);
});

test('dredge achievements are registered', () => {
  assert.match(js, /id: 'autodredge'/);
  assert.match(js, /id: 'dredgeworks'/);
});

test('dredge is saved and restored with the world', () => {
  assert.match(js, /dredges: \[\.\.\.dredges\.values\(\)\]/);
  assert.match(js, /savedGame\.dredges/);
});

test('controls help documents the dredge (desktop and touch)', () => {
  const entries = html.match(/Драга/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
