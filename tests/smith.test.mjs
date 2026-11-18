import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('smith is wired into every machine guard chain next to chapels', () => {
  const chpChains = (js.match(/!?chapels\.has\(/g) || []).length;
  const smtChains = (js.match(/!?smiths\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про каплиці, має знати і про ковалів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(smtChains >= chpChains - 8,
    `smiths.has: ${smtChains}, chapels.has: ${chpChains}`);
});

test('smith ticks with the other machines after the chapels', () => {
  assert.match(js, /updateChapels\(dt\);[\s\S]{0,400}updateSmiths\(dt\);/);
});

test('smith forges the forge ladder in anvil order: pick, sword, shield, armor', () => {
  assert.match(js, /function smithTracks\(\)/);
  assert.match(js,
    /PICK_TIERS[\s\S]{0,120}SWORD_TIERS[\s\S]{0,120}SHIELD_TIERS[\s\S]{0,120}ARMOR_TIERS/);
});

test('smith forges by the very same move as the anvil button (shared finish path)', () => {
  // спільне завершення кування — одне на руку і коваля
  for (const fn of ['finishForgePick', 'finishForgeSword',
                    'finishForgeShield', 'finishForgeArmor']) {
    const defs = (js.match(new RegExp(`function ${fn}\\(`, 'g')) || []).length;
    assert.equal(defs, 1, `${fn} має бути визначений рівно раз`);
    // рука (кнопка «Скувати» ковадла) теж іде через спільне завершення
    assert.match(js, new RegExp(`${fn}\\(t, forgeAnvil\\);`));
  }
  // коваль кує тим самим завершенням
  assert.match(js, /plan\.finish\(plan\.t, s\);/);
});

test('smith pays the anvil price from the fullest chest shelves atomically', () => {
  assert.match(js, /function smithCost\(s, cost\)/);
  // ціна — та сама, що в кузні ковадла (рецепт рівня)
  assert.match(js, /const takes = smithCost\(s, tr\.tiers\[t\]\.cost\);/);
  // кожна штука береться з найповнішої полиці; бракує — молот чекає
  assert.match(js, /if \(!best\) return null;\s*\/\/ металу бракує — молот чекає/);
  // обмін атомарний: метал сходить лише в smithFinish
  assert.match(js, /function smithFinish\(s, plan\)[\s\S]{0,300}chest\.store\[kind\]--;/);
});

test('smith needs a living player in reach', () => {
  assert.match(js, /function smithPatron\(s\)\s*\{\s*\n\s*if \(player\.dead\) return false;/);
  assert.match(js, /SMITH_REACH \* SMITH_REACH/);
});

test('smith waits idle without power', () => {
  assert.match(js, /function smithPowered\(s\)/);
  assert.match(js, /const on = smithPowered\(s\);[\s\S]{0,200}if \(!on\) \{ s\.forgeWorkT = 0; continue; \}/);
});

test('hand forge path at the anvil stays', () => {
  assert.match(js, /function doForge\(t\)/);
  assert.match(js, /function doForgeSword\(t\)/);
  assert.match(js, /function doForgeShield\(t\)/);
  assert.match(js, /function doForgeArmor\(t\)/);
  assert.match(js, /if \(!canAffordForge\(tier\.cost\)\) return false;/);
});

test('smith achievements are registered', () => {
  assert.match(js, /id: 'autoforge'/);
  assert.match(js, /id: 'forgeworks'/);
});

test('smith is saved and restored with the world', () => {
  assert.match(js, /smiths: \[\.\.\.smiths\.values\(\)\]/);
  assert.match(js, /savedGame\.smiths/);
});

test('controls help documents the smith (desktop and touch)', () => {
  const entries = html.match(/Коваль/g) || [];
  assert.ok(entries.length >= 2, `«Коваль» згадок у довідці: ${entries.length}`);
});
