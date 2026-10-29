import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('healer is wired into every machine guard chain next to fertilizers', () => {
  const fertChains = (js.match(/!?fertilizers\.has\(/g) || []).length;
  const healChains = (js.match(/!?healers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про добривниці, має знати і про знахарок
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(healChains >= fertChains - 8,
    `healers.has: ${healChains}, fertilizers.has: ${fertChains}`);
});

test('healer ticks with the other machines after the fertilizers', () => {
  assert.match(js, /updateFertilizers\(dt\);[\s\S]{0,400}updateHealers\(dt\);/);
});

test('healer needs a wounded player in reach and a chest with honey', () => {
  // сяг знахарки обмежений відстанню до гравця
  assert.match(js, /HEALER_REACH \* HEALER_REACH/);
  // здоровий гравець недоторканний — та сама мірка, що й у ковтка з торби
  assert.match(js, /if \(player\.health > MAX_HEALTH - HONEY_HEAL \/ 2\) return false;/);
  // мертвому ополоник не ллє
  assert.match(js, /if \(player\.dead\) return false;/);
  // без гравця в сягу чи меду на полиці — ополоник чекає впорожні
  assert.match(js, /const chest = healerTarget\(h\);/);
  // мед береться з найповнішої полиці скрині впритул
  assert.match(js, /const n = ch\.store\.honey \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}\s*\n\s*\}\s*\n\s*return bestN >= 1 \? best : null;/);
});

test('healing is atomic at the moment of finishing (nothing to lose)', () => {
  // мед сходить з полиці і рани гояться всередині healerFinish —
  // зламана знахарка нічого не губить
  assert.match(js, /function healerFinish\(h, chest\)/);
  assert.match(js, /chest\.store\.honey -= 1;/);
  assert.match(js, /h\.healed = \(h\.healed \| 0\) \+ 1;/);
});

test('healer applies the same portion as the hand honey sip', () => {
  // рани гояться на HONEY_HEAL і голод трохи вгамовується, як у ковтка
  assert.match(js, /player\.health = Math\.min\(MAX_HEALTH, player\.health \+ HONEY_HEAL\);\s*\n\s*player\.hunger = Math\.min\(MAX_HUNGER, player\.hunger \+ HONEY_HUNGER\);\s*\n\s*if \(chestOpen && chestCur === chest\)/);
});

test('hand path stays: honey is still sipped from the bag when hurt', () => {
  // мед із торби, як і раніше, п'ється сам, коли бракує здоров'я
  assert.match(js, /if \(player\.honey > 0 && player\.health <= MAX_HEALTH - HONEY_HEAL \/ 2\) \{/);
  assert.match(js, /player\.honey -= 1;/);
});

test('healer achievements are registered', () => {
  assert.match(js, /id: 'autoheal'/);
  assert.match(js, /id: 'healhouse'/);
});

test('healer is saved and restored with the world', () => {
  assert.match(js, /healers: \[\.\.\.healers\.values\(\)\]/);
  assert.match(js, /savedGame\.healers/);
});

test('controls help documents the healer (desktop and touch)', () => {
  const entries = html.match(/Знахарка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
