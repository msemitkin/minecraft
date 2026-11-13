import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('forester is wired into every machine guard chain next to lumberjacks', () => {
  const lmbChains = (js.match(/!?lumberjacks\.has\(/g) || []).length;
  const frsChains = (js.match(/!?foresters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про лісорубів, має знати і про лісничих
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(frsChains >= lmbChains - 8,
    `foresters.has: ${frsChains}, lumberjacks.has: ${lmbChains}`);
});

test('forester ticks with the other machines after the lumberjacks', () => {
  assert.match(js, /updateLumberjacks\(dt\);[\s\S]{0,400}updateForesters\(dt\);/);
});

test('forester plants by the very same rules as the hand', () => {
  // та сама перевірка клітинки для руки і для лісничого
  assert.match(js, /function saplingCellFree\(x, y, z\)/);
  assert.match(js, /if \(!saplingCellFree\(x, y, z\)\) return false;\s*\n\s*if \(!addSapling\(x, y, z\)\) return false;/);
  // лісничий садить тим самим ходом plantSapling — звук і ріст як з руки
  assert.match(js, /if \(!plantSapling\(\{ prev: \[spot\.x, spot\.y, spot\.z\] \}\)\) return;/);
});

test('forester plants on a ring with clearance so the grove can grow', () => {
  // кільце 2–3 блоки від тумби, ±1 по вертикалі
  assert.match(js, /const FORESTER_NEAR = 2;/);
  assert.match(js, /const FORESTER_REACH = 3;/);
  assert.match(js, /if \(Math\.max\(Math\.abs\(dx\), Math\.abs\(dz\)\) < FORESTER_NEAR\) continue;/);
  // просвіт: ні саджанця, ні стовбура в колі FORESTER_SPACING
  assert.match(js, /const FORESTER_SPACING = 2;/);
  assert.match(js, /function foresterClearance\(x, y, z\)/);
  // межа саджанців світу шанується — лоток не переповнює збереження
  assert.match(js, /if \(saplings\.size >= SAPLING_MAX\) return null;/);
  // найближче місце перше
  assert.match(js, /const score = -\(dx \* dx \+ dz \* dz\) \* 100 \+ dy;[\s\S]{0,900}function foresterFinish/);
});

test('planting is atomic: an occupied spot is skipped, nothing is lost', () => {
  // місце перевіряється ще раз у мить посадки; зайняте — пропускається
  assert.match(js, /function foresterFinish\(f\)/);
  assert.match(js, /if \(!spot \|\| !foresterClearance\(spot\.x, spot\.y, spot\.z\)\) return;/);
  assert.match(js, /f\.planted = \(f\.planted \| 0\) \+ 1;/);
});

test('forester-planted trees are real: they grow through the grownLogs registry', () => {
  // лісничий садить справжні саджанці — ріст іде через growSaplingTree,
  // що пише стовбур у реєстр grownLogs (колоди для руки й лісоруба)
  assert.match(js, /grownLogs\.add\(x \+ ',' \+ \(y \+ dy\) \+ ',' \+ z\);/);
  assert.match(js, /лісоруб і рука братимуть з нього колоди/);
});

test('forester achievements are registered', () => {
  assert.match(js, /id: 'autoplant'/);
  assert.match(js, /id: 'grove'/);
});

test('forester is saved and restored with the world', () => {
  assert.match(js, /foresters: \[\.\.\.foresters\.values\(\)\]/);
  assert.match(js, /savedGame\.foresters/);
});

test('controls help documents the forester (desktop and touch)', () => {
  const entries = html.match(/Лісничий/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
