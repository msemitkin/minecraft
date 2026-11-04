import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('milkmaid is wired into every machine guard chain next to barters', () => {
  const brtChains = (js.match(/!?barters\.has\(/g) || []).length;
  const mlkChains = (js.match(/!?milkmaids\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про крамарок, має знати і про доярок
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(mlkChains >= brtChains - 8,
    `milkmaids.has: ${mlkChains}, barters.has: ${brtChains}`);
});

test('milkmaid ticks with the other machines after the barters', () => {
  assert.match(js, /updateBarters\(dt\);[\s\S]{0,400}updateMilkmaids\(dt\);/);
});

test('milkmaid needs a milkable cow and a player the milk suits', () => {
  // сяг доярки обмежений відстанню до гравця і до корови
  assert.match(js, /MILKMAID_REACH \* MILKMAID_REACH/);
  assert.match(js, /MILKMAID_COW_R \* MILKMAID_COW_R/);
  // телятко не доїться, корова на перезарядці — надоюється
  assert.match(js, /if \(a\.type !== 'cow' \|\| a\.baby\) continue;/);
  assert.match(js, /if \(onlyReady && a\.milkTimer > 0\) continue;/);
  // мертвому кухоль не подає
  assert.match(js, /function milkmaidPatron\(m\) \{\s*\n\s*if \(player\.dead\) return false;/);
  // без корови в сягу чи гравця, якому молоко впору — чекає впорожні
  assert.match(js, /const cow = milkmaidTarget\(m\);/);
});

test('milkmaid serves only a full portion, or a burning player', () => {
  // ситий і не палаючий гравець недоторканний — ні краплі не марнується
  assert.match(js, /const burning = player\.fireTicks > 0;\s*\n\s*if \(!burning && MAX_HUNGER - player\.hunger < MILK_FOOD\) return false;/);
});

test('milkmaid needs no chest: the living cow is the pantry', () => {
  // перша машина зовсім без скрині — у секції доярки немає жодної згадки полиць
  const section = js.slice(js.indexOf('// Доярка: мережа доїть корову'),
    js.indexOf('// Рудокопка: мережа копає руду'));
  assert.ok(section.length > 0, 'секцію доярки знайдено');
  assert.ok(!/chests\.values\(\)/.test(section), 'доярка не читає скринь');
  assert.ok(!/\.store\[/.test(section), 'доярка не чіпає полиць');
});

test('serving is atomic at the moment of finishing (nothing to lose)', () => {
  // корова доїться, голод вгамовується і полум'я гасне всередині
  // milkmaidFinish — зламана доярка нічого не губить
  assert.match(js, /function milkmaidFinish\(m, cow\)/);
  assert.match(js, /cow\.milkTimer = MILK_COOLDOWN;\s*\n\s*const burning = player\.fireTicks > 0;\s*\n\s*player\.hunger = Math\.min\(MAX_HUNGER, player\.hunger \+ MILK_FOOD\);/);
  assert.match(js, /m\.served = \(m\.served \| 0\) \+ 1;/);
});

test('machine milking respects the same cooldown as the hand', () => {
  // корова надоюється знову за MILK_COOLDOWN — як від ручного доїння
  const uses = (js.match(/milkTimer = MILK_COOLDOWN/g) || []).length;
  assert.ok(uses >= 2, `milkTimer = MILK_COOLDOWN згадок: ${uses}`);
});

test('hand path stays: the bucket still milks and milk is drunk by hand', () => {
  // відро, як і раніше, доїть по ПКМ і молоко п'ється з руки
  assert.match(js, /function milkCowEntity\(cow\)/);
  assert.match(js, /function drinkMilk\(\)/);
  assert.match(js, /if \(held === MILK_BUCKET\) \{ drinkMilk\(\); return; \}/);
});

test('milkmaid achievements are registered', () => {
  assert.match(js, /id: 'automilk'/);
  assert.match(js, /id: 'dairyfarm'/);
});

test('milkmaid is saved and restored with the world', () => {
  assert.match(js, /milkmaids: \[\.\.\.milkmaids\.values\(\)\]/);
  assert.match(js, /savedGame\.milkmaids/);
});

test('controls help documents the milkmaid (desktop and touch)', () => {
  const entries = html.match(/Доярка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
