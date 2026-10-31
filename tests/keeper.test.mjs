import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('storekeeper is wired into every machine guard chain next to canteens', () => {
  const cantChains = (js.match(/!?canteens\.has\(/g) || []).length;
  const keepChains = (js.match(/!?keepers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про трапезниці, має знати і про комірниці
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(keepChains >= cantChains - 8,
    `keepers.has: ${keepChains}, canteens.has: ${cantChains}`);
});

test('storekeeper ticks with the other machines after the canteens', () => {
  assert.match(js, /updateCanteens\(dt\);[\s\S]{0,400}updateKeepers\(dt\);/);
});

test('storekeeper needs a player with goods in reach and a chest with room', () => {
  // сяг комірниці обмежений відстанню до гравця
  assert.match(js, /KEEPER_REACH \* KEEPER_REACH/);
  // мертвого кошик не обшукує
  assert.match(js, /function keeperClient\(s\) \{\s*\n\s*if \(player\.dead\) return false;/);
  // без гравця в сягу чи місця на полиці — кошик чекає впорожні
  assert.match(js, /const load = keeperTarget\(s\);/);
  // крам кладеться на найповнішу (та ще не повну) полицю скрині впритул
  assert.match(js, /if \(n < CHEST_STACK && n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('storekeeper unloads the heaviest bag pocket first', () => {
  // кишені торби йдуть від найважчої до найлегшої
  assert.match(js, /\.filter\(\(kind\) => \(player\[kind\] \| 0\) > 0\)\s*\n\s*\.sort\(\(a, b\) => \(player\[b\] \| 0\) - \(player\[a\] \| 0\)\);/);
});

test('storing is atomic at the moment of finishing (nothing to lose)', () => {
  // штука сходить з торби і лягає на полицю всередині keeperFinish —
  // зламана комірниця нічого не губить
  assert.match(js, /function keeperFinish\(s, load\)/);
  assert.match(js, /player\[kind\] -= 1;\s*\n\s*chest\.store\[kind\] = \(chest\.store\[kind\] \| 0\) \+ 1;/);
  assert.match(js, /s\.stored = \(s\.stored \| 0\) \+ 1;/);
});

test('hand path stays: the chest panel still moves goods both ways', () => {
  // панель скрині, як і раніше, перекладає крам по ▼/▲
  assert.match(js, /function chestDeposit\(kind, n\)/);
  assert.match(js, /function chestWithdraw\(kind, n\)/);
});

test('storekeeper achievements are registered', () => {
  assert.match(js, /id: 'autostore'/);
  assert.match(js, /id: 'fullstore'/);
});

test('storekeeper is saved and restored with the world', () => {
  assert.match(js, /keepers: \[\.\.\.keepers\.values\(\)\]/);
  assert.match(js, /savedGame\.keepers/);
});

test('controls help documents the storekeeper (desktop and touch)', () => {
  const entries = html.match(/Комірниця/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
