import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('fisher is wired into every machine guard chain next to incubators', () => {
  const incubatorChains = (js.match(/!?incubators\.has\(/g) || []).length;
  const fisherChains = (js.match(/!?fishers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про інкубатори, має знати і про самолови
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(fisherChains >= incubatorChains - 8,
    `fishers.has: ${fisherChains}, incubators.has: ${incubatorChains}`);
});

test('fisher ticks with the other machines after the incubators', () => {
  assert.match(js, /updateIncubators\(dt\);[\s\S]{0,200}updateFishers\(dt\);/);
});

test('fisher needs water and a chest with shelf space, and pays out FISH_FOOD', () => {
  // без води поплавець чекає впорожні
  assert.match(js, /if \(!fisherWater\(f\)\) \{ f\.bob\.position\.y = 0\.3; continue; \}/);
  // полиця м'яса добирає ту саму порцію, що й вудка
  assert.match(js, /chest\.store\.food = Math\.min\(CHEST_STACK, cur \+ FISH_FOOD\);/);
  // скриня впритул береться лише з місцем на полиці м'яса
  assert.match(js, /\(ch\.store\.food \| 0\) < CHEST_STACK/);
});

test('fisher catch is added only at the moment of the pull (nothing to lose)', () => {
  // улов додається всередині fisherFinish — зламаний самолов нічого не губить
  assert.match(js, /function fisherFinish\(f, chest\)/);
  assert.match(js, /f\.caught = \(f\.caught \| 0\) \+ 1;/);
});

test('fisher achievements are registered', () => {
  assert.match(js, /id: 'autofish'/);
  assert.match(js, /id: 'fishworks'/);
});

test('fisher is saved and restored with the world', () => {
  assert.match(js, /fishers: \[\.\.\.fishers\.values\(\)\]/);
  assert.match(js, /savedGame\.fishers/);
});

test('controls help documents the fisher (desktop and touch)', () => {
  const entries = html.match(/Самолов/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
