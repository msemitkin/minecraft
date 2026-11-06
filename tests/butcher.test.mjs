import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('butcher is wired into every machine guard chain next to kennels', () => {
  const knlChains = (js.match(/!?kennels\.has\(/g) || []).length;
  const bchChains = (js.match(/!?butchers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про псарні, має знати і про різників
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(bchChains >= knlChains - 8,
    `butchers.has: ${bchChains}, kennels.has: ${knlChains}`);
});

test('butcher ticks with the other machines after the kennels', () => {
  assert.match(js, /updateKennels\(dt\);[\s\S]{0,400}updateButchers\(dt\);/);
});

test('butcher culls only a grown, loose farm animal from a surplus herd', () => {
  // лише свійське з BREED_TYPES, доросле й живе
  assert.match(js, /if \(!BREED_TYPES\.has\(a\.type\) \|\| a\.baby \|\| a\.health <= 0\) continue;/);
  // остання пара недоторканна — ріжеться лише череда з надлишком
  assert.match(js, /const BUTCHER_HERD_MIN = 3;/);
  assert.match(js, /if \(herd\[a\.type\] < BUTCHER_HERD_MIN\) continue;/);
  // закохана (у «настрої» після годівниці) — недоторканна
  assert.match(js, /if \(a\.love > 0\) continue;\s*\/\/ закохана/);
  // сяг різника обмежений
  assert.match(js, /const BUTCHER_REACH = 4;/);
});

test('the whole carcass goes to the fullest shelf with room for it', () => {
  // вся пайка або нічого — полиця з місцем для цілої туші
  assert.match(js, /function butcherChest\(b, portion\) \{\s*\n\s*let best = null, bestN = -1;/);
  assert.match(js, /if \(n \+ portion <= CHEST_STACK && n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('culling is atomic: same portion as the hand hunt, nothing lost in transit', () => {
  assert.match(js, /function butcherFinish\(b, beast\)/);
  assert.match(js, /if \(beast\.health <= 0 \|\| beast\.baby \|\| beast\.love > 0\) return;/);
  // та сама пайка, що й з руки — entity.foodValue
  assert.match(js, /chest\.store\.food = Math\.min\(CHEST_STACK, \(chest\.store\.food \| 0\) \+ beast\.foodValue\);/);
  assert.match(js, /b\.culled = \(b\.culled \| 0\) \+ 1;/);
});

test('hand path stays: hunting by LMB still fills the bag', () => {
  assert.match(js, /player\.food = Math\.min\(FOOD_MAX, player\.food \+ entity\.foodValue\);/);
});

test('butcher achievements are registered', () => {
  assert.match(js, /id: 'automeat'/);
  assert.match(js, /id: 'meatyard'/);
});

test('butcher is saved and restored with the world', () => {
  assert.match(js, /butchers: \[\.\.\.butchers\.values\(\)\]/);
  assert.match(js, /savedGame\.butchers/);
});

test('controls help documents the butcher (desktop and touch)', () => {
  const entries = html.match(/Різник/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
