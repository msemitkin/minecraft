import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('outfitter is wired into every machine guard chain next to swineherds', () => {
  const swhChains = (js.match(/!?swineherds\.has\(/g) || []).length;
  const otfChains = (js.match(/!?outfitters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про свинопасів, має знати і про спорядниць
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(otfChains >= swhChains - 8,
    `outfitters.has: ${otfChains}, swineherds.has: ${swhChains}`);
});

test('outfitter ticks with the other machines after the swineherds', () => {
  assert.match(js, /updateSwineherds\(dt\);[\s\S]{0,400}updateOutfitters\(dt\);/);
});

test('outfitter issues by the same move as the chest panel ▲', () => {
  // полиця меншає, порожня зникає (як у chestWithdraw), кишеня росте
  assert.match(js, /function outfitterFinish\(s, load\) \{[\s\S]{0,300}chest\.store\[kind\] -= 1;[\s\S]{0,120}if \(chest\.store\[kind\] <= 0\) delete chest\.store\[kind\];[\s\S]{0,120}player\[kind\] = \(player\[kind\] \| 0\) \+ 1;/);
});

test('outfitter honours the bag cap: full pockets are never overfilled', () => {
  // кишені понад кап торби відсіюються ще при виборі краму
  assert.match(js, /function outfitterLoad\(s\) \{[\s\S]{0,300}\(player\[kind\] \| 0\) < CHEST_GOODS\[kind\]\.max/);
  // найлегша кишеня першою — спорядниця латає найбідніше
  assert.match(js, /\.sort\(\(a, b\) => \(player\[a\] \| 0\) - \(player\[b\] \| 0\)\)/);
});

test('keeper outranks outfitter: no tug-of-war over the same goods', () => {
  // поки гравця в сягу розвантажує увімкнена комірниця — саква мовчить
  assert.match(js, /function outfitterYields\(\) \{[\s\S]{0,200}kp\.on && keeperClient\(kp\)/);
  assert.match(js, /function outfitterTarget\(s\) \{[\s\S]{0,200}if \(outfitterYields\(\)\) return null;/);
});

test('exchange is atomic: issue happens in one finish move, break loses nothing', () => {
  // зламана спорядниця нічого не губить — крам ще на полиці
  assert.match(js, /function breakOutfitter\(key\) \{[\s\S]{0,400}removeOutfitter\(key\);/);
  // зарахунок і здобутки — лише в мить видавання
  assert.match(js, /s\.issued = \(s\.issued \| 0\) \+ 1;[\s\S]{0,120}unlockAch\('autokit'\);/);
});

test('dead player is never outfitted', () => {
  assert.match(js, /function outfitterClient\(s\) \{[\s\S]{0,120}if \(player\.dead\) return false;/);
});

test('hand path stays: chest panel still transfers goods both ways', () => {
  assert.match(js, /function chestWithdraw\(kind, n\)/);
  assert.match(js, /function chestDeposit\(kind, n\)/);
});

test('outfitter achievements are registered', () => {
  assert.match(js, /id: 'autokit'/);
  assert.match(js, /id: 'fullkit'/);
});

test('outfitter is saved and restored with the world', () => {
  assert.match(js, /outfitters: \[\.\.\.outfitters\.values\(\)\]/);
  assert.match(js, /savedGame\.outfitters/);
});

test('controls help documents the outfitter (desktop and touch)', () => {
  const entries = html.match(/Спорядниця/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
