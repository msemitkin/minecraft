import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('waterbearer is wired into every machine guard chain next to cupbearers', () => {
  const cpbChains = (js.match(/!?cupbearers\.has\(/g) || []).length;
  const wbrChains = (js.match(/!?waterbearers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про чашників, має знати і про водоносів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(wbrChains >= cpbChains - 8,
    `waterbearers.has: ${wbrChains}, cupbearers.has: ${cpbChains}`);
});

test('waterbearer ticks with the other machines after the cupbearers', () => {
  assert.match(js, /updateCupbearers\(dt\);[\s\S]{0,400}updateWaterbearers\(dt\);/);
});

test('waterbearer fills only an empty cauldron', () => {
  // лише казан у стані 0 (порожній) впритул — вода, вариво й готове зілля недоторканні
  assert.match(js, /function waterbearerCauldron\(wb\) \{[\s\S]{0,500}if \(c\.state !== 0\) continue;/);
});

test('waterbearer scoops only an eternal water source, never flows or lava', () => {
  // лише вічне джерело WATER — потоки й лава не черпаються (як у відра)
  assert.match(js, /function waterbearerSource\(wb\) \{[\s\S]{0,700}=== WATER\) \{/);
});

test('filling matches the hand bucket: source vanishes, cauldron holds water', () => {
  assert.match(js, /function waterbearerFinish\(wb\)/);
  // джерело зачерпується тим самим ходом, що й відром
  assert.match(js, /function waterbearerFinish\(wb\) \{[\s\S]{0,600}setBlock\(s\.x, s\.y, s\.z, AIR\);/);
  // казан наповнюється водою, як від відра
  assert.match(js, /function waterbearerFinish\(wb\) \{[\s\S]{0,800}c\.state = 1;\s*\n\s*c\.rainT = 0;/);
});

test('exchange is atomic: filled counter grows only at the moment of pouring', () => {
  assert.match(js, /wb\.filled = \(wb\.filled \| 0\) \+ 1;/);
  // обидві умови перевіряються в мить виливання — зламаний водонос нічого не губить
  assert.match(js, /function waterbearerFinish\(wb\) \{[\s\S]{0,300}if \(!c \|\| !s\) return;/);
});

test('hand path stays: the bucket still scoops the source and fills the cauldron', () => {
  assert.match(js, /function useBucket\(\)/);
  assert.match(js, /if \(hotbar\[selectedSlot\] === WATER_BUCKET\) \{/);
  // і дощ, як і раніше, наповнює казани просто неба
  assert.match(js, /c\.rainT >= CAULDRON_RAIN_FILL/);
});

test('waterbearer achievements are registered', () => {
  assert.match(js, /id: 'autowater'/);
  assert.match(js, /id: 'aqueduct'/);
});

test('waterbearer is saved and restored with the world', () => {
  assert.match(js, /waterbearers: \[\.\.\.waterbearers\.values\(\)\]/);
  assert.match(js, /savedGame\.waterbearers/);
});

test('controls help documents the waterbearer (desktop and touch)', () => {
  const entries = html.match(/Водонос/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
