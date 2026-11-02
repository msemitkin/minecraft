import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('barter stall is wired into every machine guard chain next to menders', () => {
  const mendChains = (js.match(/!?menders\.has\(/g) || []).length;
  const brtChains = (js.match(/!?barters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про латальниці, має знати і про крамарки
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(brtChains >= mendChains - 8,
    `barters.has: ${brtChains}, menders.has: ${mendChains}`);
});

test('barter stall ticks with the other machines after the menders', () => {
  assert.match(js, /updateMenders\(dt\);[\s\S]{0,400}updateBarters\(dt\);/);
});

test('barter stall trades only with the settled villager in reach', () => {
  // сяг крамарки обмежений відстанню до сусіда
  assert.match(js, /BARTER_REACH \* BARTER_REACH/);
  // без сусіда терези не торгують (мандрівний гість — ручна ятка)
  assert.match(js, /function barterNeighbor\(s\) \{\s*\n\s*if \(!villager\) return false;/);
  // без сусіда в сягу чи здійсненної пропозиції — терези чекають впорожні
  assert.match(js, /const deal = barterTarget\(s\);/);
});

test('barter stall uses the villager daily offers and the shared stock', () => {
  // пропозиції ті самі, що в ручної крамниці — запас спільний
  assert.match(js, /function barterDeal\(s\) \{[\s\S]{0,500}villager\.offers/);
  assert.match(js, /if \(offer\.stock <= 0\) continue;/);
  assert.match(js, /offer\.stock -= 1;/);
  // першою йде пропозиція з золотим яблуком — головний приз
  assert.match(js, /b\.get === 'gapple'/);
});

test('payment leaves the fullest shelves, earnings land on the fullest not-full shelf', () => {
  // оплата: кожна штука — з найповнішої полиці свого краму
  assert.match(js, /function barterDeal\(s\) \{[\s\S]{0,2000}if \(n > bestN\) \{ bestN = n; best = ch; \}/);
  // виторг: на найповнішу, та ще не повну, полицю
  assert.match(js, /function barterDeal\(s\) \{[\s\S]{0,3000}n < CHEST_STACK && n > bestN/);
});

test('trade is atomic at the moment of finishing (nothing to lose)', () => {
  // оплата, виторг і запас пропозиції міняються всередині barterFinish —
  // зламана крамарка нічого не губить
  assert.match(js, /function barterFinish\(s, deal\)/);
  assert.match(js, /s\.traded = \(s\.traded \| 0\) \+ 1;/);
});

test('hand path stays: the shop panel and the wandering trader still trade', () => {
  // крамниця сусіда і ятка гостя торгують вручну, як і раніше
  assert.match(js, /function doTrade\(offer\)/);
  assert.match(js, /function openTradePanel\(keeper = trader\)/);
});

test('barter achievements are registered', () => {
  assert.match(js, /id: 'autotrade'/);
  assert.match(js, /id: 'tradefair'/);
});

test('barter stall is saved and restored with the world', () => {
  assert.match(js, /barters: \[\.\.\.barters\.values\(\)\]/);
  assert.match(js, /savedGame\.barters/);
});

test('controls help documents the barter stall (desktop and touch)', () => {
  const entries = html.match(/Крамарка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
