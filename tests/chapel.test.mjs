import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('chapel is wired into every machine guard chain next to confectioners', () => {
  const cnfChains = (js.match(/!?confectioners\.has\(/g) || []).length;
  const chpChains = (js.match(/!?chapels\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про медові печі, має знати і про каплиці
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(chpChains >= cnfChains - 8,
    `chapels.has: ${chpChains}, confectioners.has: ${cnfChains}`);
});

test('chapel ticks with the other machines after the confectioners', () => {
  assert.match(js, /updateConfectioners\(dt\);[\s\S]{0,400}updateChapels\(dt\);/);
});

test('chapel needs a chest with a golden apple, an empty homestead and a zombie in reach', () => {
  // скриня береться лише з золотим яблуком на полиці
  assert.match(js, /\(ch\.store\.gapple \|\| 0\) >= 1/);
  // сусід живий чи чиєсь зцілення триває — каплиця чекає мовчки
  assert.match(js, /if \(villager \|\| mobs\.some\(\(m\) => m\.curing > 0\)\) continue;/);
  // без скрині чи без зомбі в сягу молитва не йде
  assert.match(js, /const chest = chapelChest\(c\);\s*\n\s*if \(!chest\) continue;/);
  assert.match(js, /const m = chapelZombie\(c\);\s*\n\s*if \(!m\) continue;/);
});

test('chapel feeds the apple by the very same move as the hand (shared cure path)', () => {
  // яблуко сходить із полиці атомарно в мить частування
  assert.match(js, /function chapelFeed\(c, chest, m\)/);
  assert.match(js, /chest\.store\.gapple -= 1;/);
  // зомбі здригається тим самим CURE_TIME, що й від ПКМ руки
  assert.match(js, /m\.curing = CURE_TIME;[\s\S]{0,600}c\.cured = \(c\.cured \| 0\) \+ 1;/);
  // перетворення веде спільний transformCuredZombie — окремого шляху нема
  const transforms = (js.match(/function transformCuredZombie\(/g) || []).length;
  assert.equal(transforms, 1);
});

test('chapel only cures real zombies not already mid-cure', () => {
  assert.match(js, /if \(m\.type !== 'zombie' \|\| m\.curing > 0\) continue;/);
  assert.match(js, /d <= CHAPEL_REACH \* CHAPEL_REACH/);
});

test('hand cure path stays untouched', () => {
  assert.match(js, /function tryCureZombie\(\)/);
  assert.match(js, /player\.gapple -= 1;/);
});

test('chapel waits idle without power', () => {
  assert.match(js, /function chapelPowered\(c\)/);
  assert.match(js, /const on = chapelPowered\(c\);[\s\S]{0,200}if \(!on\) continue;/);
});

test('chapel achievements are registered', () => {
  assert.match(js, /id: 'autocure'/);
  assert.match(js, /id: 'parish'/);
});

test('chapel is saved and restored with the world', () => {
  assert.match(js, /chapels: \[\.\.\.chapels\.values\(\)\]/);
  assert.match(js, /savedGame\.chapels/);
});

test('controls help documents the chapel (desktop and touch)', () => {
  const entries = html.match(/Каплиця/g) || [];
  assert.ok(entries.length >= 2, `«Каплиця» згадок у довідці: ${entries.length}`);
});
