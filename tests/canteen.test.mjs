import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('canteen is wired into every machine guard chain next to healers', () => {
  const healChains = (js.match(/!?healers\.has\(/g) || []).length;
  const cantChains = (js.match(/!?canteens\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про знахарок, має знати і про трапезниці
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(cantChains >= healChains - 8,
    `canteens.has: ${cantChains}, healers.has: ${healChains}`);
});

test('canteen ticks with the other machines after the healers', () => {
  assert.match(js, /updateHealers\(dt\);[\s\S]{0,400}updateCanteens\(dt\);/);
});

test('canteen needs a hungry player in reach and a chest with a dish', () => {
  // сяг трапезниці обмежений відстанню до гравця
  assert.match(js, /CANTEEN_REACH \* CANTEEN_REACH/);
  // ситий гравець недоторканний
  assert.match(js, /if \(player\.hunger >= MAX_HUNGER\) return false;/);
  // мертвому ложка не подає
  assert.match(js, /function canteenPatron\(c\) \{\s*\n\s*if \(player\.dead\) return false;/);
  // без гравця в сягу чи страви на полиці — ложка чекає впорожні
  assert.match(js, /const dish = canteenTarget\(c\);/);
  // страва береться з найповнішої полиці скрині впритул
  assert.match(js, /const n = ch\.store\[kind\] \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('canteen serves only a full portion that fits the hunger deficit', () => {
  // порція, що не влазить у голод, не марнується — чекаємо більшого голоду
  assert.match(js, /const deficit = MAX_HUNGER - player\.hunger;\s*\n\s*for \(const \[kind, food\] of CANTEEN_MENU\) \{\s*\n\s*if \(food > deficit\) continue;/);
});

test('canteen serves dishes in the same ladder as the hand (bread first)', () => {
  // той самий щабель, що й у руки: хліб → смаженина → гриби → молюск → опунції
  assert.match(js, /\['bread',\s+BREAD_FOOD\],\s*\n\s*\['cooked',\s+COOKED_FOOD\],\s*\n\s*\['roast',\s+ROAST_FOOD\],\s*\n\s*\['mollusk',\s+MOLLUSK_FOOD\],\s*\n\s*\['baked',\s+BAKED_FOOD\],/);
});

test('serving is atomic at the moment of finishing (nothing to lose)', () => {
  // страва сходить з полиці і голод вгамовується всередині canteenFinish —
  // зламана трапезниця нічого не губить
  assert.match(js, /function canteenFinish\(c, dish\)/);
  assert.match(js, /chest\.store\[kind\] -= 1;\s*\n\s*player\.hunger = Math\.min\(MAX_HUNGER, player\.hunger \+ food\);/);
  assert.match(js, /c\.served = \(c\.served \| 0\) \+ 1;/);
});

test('hand path stays: food is still eaten from the bag on F', () => {
  // їжа з торби, як і раніше, їсться по F
  assert.match(js, /function eatFood\(\)/);
  assert.match(js, /if \(e\.code === 'KeyF'\) \{ Sound\.resume\(\); eatFood\(\); return; \}/);
});

test('canteen achievements are registered', () => {
  assert.match(js, /id: 'autodine'/);
  assert.match(js, /id: 'messhall'/);
});

test('canteen is saved and restored with the world', () => {
  assert.match(js, /canteens: \[\.\.\.canteens\.values\(\)\]/);
  assert.match(js, /savedGame\.canteens/);
});

test('controls help documents the canteen (desktop and touch)', () => {
  const entries = html.match(/Трапезниця/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
