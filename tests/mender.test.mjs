import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('mender is wired into every machine guard chain next to keepers', () => {
  const keepChains = (js.match(/!?keepers\.has\(/g) || []).length;
  const mendChains = (js.match(/!?menders\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про комірниці, має знати і про латальниці
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(mendChains >= keepChains - 8,
    `menders.has: ${mendChains}, keepers.has: ${keepChains}`);
});

test('mender ticks with the other machines after the keepers', () => {
  assert.match(js, /updateKeepers\(dt\);[\s\S]{0,400}updateMenders\(dt\);/);
});

test('mender needs a worn armored player in reach and mend metal on shelves', () => {
  // сяг латальниці обмежений відстанню до гравця
  assert.match(js, /MENDER_REACH \* MENDER_REACH/);
  // мертвого і беззахисного молоток не чіпає
  assert.match(js, /function menderPatron\(s\) \{\s*\n\s*if \(player\.dead \|\| player\.armorTier <= 0\) return false;/);
  // цілий обладунок недоторканний — ані штуки металу не змарнується
  assert.match(js, /function menderPatron\(s\) \{[\s\S]{0,220}armorHp >= tier\.hp\) return false;/);
  // без гравця в сягу чи металу на полицях — молоток чекає впорожні
  assert.match(js, /const takes = menderTarget\(s\);/);
});

test('mender pays the anvil mend price, taken from the fullest shelves', () => {
  // ціна лагодження — ARMOR_TIERS[].mend, та сама, що в кнопки «Полагодити»
  assert.match(js, /function menderCost\(s\) \{\s*\n\s*const tier = ARMOR_TIERS\[player\.armorTier\];\s*\n\s*if \(!tier \|\| !tier\.mend\) return null;/);
  // кожна штука береться з найповнішої полиці свого краму
  assert.match(js, /if \(n > bestN\) \{ bestN = n; best = ch; \}/);
  // ручне лагодження ковадла платить тим самим прейскурантом
  assert.match(js, /mend: \{ iron: 2 \}/);
});

test('mending is atomic at the moment of finishing (nothing to lose)', () => {
  // метал сходить з полиць і міцність повниться всередині menderFinish —
  // зламана латальниця нічого не губить
  assert.match(js, /function menderFinish\(s, takes\)/);
  assert.match(js, /function menderFinish\(s, takes\) \{[\s\S]{0,400}player\.armorHp = tier\.hp;/);
  assert.match(js, /s\.mended = \(s\.mended \| 0\) \+ 1;/);
});

test('hand path stays: the anvil still forges and mends', () => {
  // ковадло, як і раніше, кує нові обладунки й латає вручну
  assert.match(js, /function doForgeArmor\(t\)/);
  assert.match(js, /function doMendArmor\(\)/);
});

test('mender achievements are registered', () => {
  assert.match(js, /id: 'automend'/);
  assert.match(js, /id: 'mendguild'/);
});

test('mender is saved and restored with the world', () => {
  assert.match(js, /menders: \[\.\.\.menders\.values\(\)\]/);
  assert.match(js, /savedGame\.menders/);
});

test('controls help documents the mender (desktop and touch)', () => {
  const entries = html.match(/Латальниця/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
