import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('incubator is wired into every machine guard chain next to extractors', () => {
  const extractorChains = (js.match(/!?extractors\.has\(/g) || []).length;
  const incubatorChains = (js.match(/!?incubators\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про медогонки, має знати і про інкубатори
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(incubatorChains >= extractorChains - 8,
    `incubators.has: ${incubatorChains}, extractors.has: ${extractorChains}`);
});

test('incubator ticks with the other machines and keeps the exchange atomic', () => {
  assert.match(js, /updateIncubators\(dt\);/);
  // яйце сходить із полиці лише в мить вилуплення — всередині incubatorFinish
  assert.match(js, /chest\.store\.eggs = \(chest\.store\.eggs \| 0\) - 1;/);
  assert.match(js, /spawnAnimal\('chicken', i\.x \+ 0\.5, i\.y \+ 0\.35, i\.z \+ 0\.5, \{ baby: true \}\)/);
});

test('incubator respects the breeding cap so the flock cannot explode', () => {
  assert.match(js, /animals\.length >= BREED_ANIMAL_CAP\) \{ i\.egg\.rotation\.z = 0; continue; \}/);
});

test('incubator achievements are registered', () => {
  assert.match(js, /id: 'autohatch'/);
  assert.match(js, /id: 'hatchery'/);
});

test('incubator is saved and restored with the world', () => {
  assert.match(js, /incubators: \[\.\.\.incubators\.values\(\)\]/);
  assert.match(js, /savedGame\.incubators/);
});

test('controls help documents the incubator (desktop and touch)', () => {
  const entries = html.match(/Інкубатор/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
