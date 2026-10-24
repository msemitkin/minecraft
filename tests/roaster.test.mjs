import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('roaster is wired into every machine guard chain next to gardeners', () => {
  const gardenerChains = (js.match(/!?gardeners\.has\(/g) || []).length;
  const roasterChains = (js.match(/!?roasters\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про садівники, має знати і про запікальні
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(roasterChains >= gardenerChains - 8,
    `roasters.has: ${roasterChains}, gardeners.has: ${gardenerChains}`);
});

test('roaster ticks with the other machines after the gardeners', () => {
  assert.match(js, /updateGardeners\(dt\);[\s\S]{0,400}updateRoasters\(dt\);/);
});

test('roaster needs a chest with fruit and shelf space for baked opuntia', () => {
  // скриня впритул береться лише з плодами і місцем на полиці печених
  assert.match(js, /\(ch\.store\.fruit \| 0\) >= 1 && \(ch\.store\.baked \| 0\) < CHEST_STACK/);
  // без скрині — піч пашить дарма
  assert.match(js, /const chest = roasterChest\(r\);/);
});

test('roaster exchange is atomic at the moment of readiness (nothing to lose)', () => {
  // плід стає печеною опунцією всередині roasterFinish —
  // зламана запікальня нічого не губить
  assert.match(js, /function roasterFinish\(r, chest\)/);
  assert.match(js, /chest\.store\.fruit -= 1;\s*\n\s*chest\.store\.baked = \(chest\.store\.baked \| 0\) \+ 1;/);
  assert.match(js, /r\.baked = \(r\.baked \| 0\) \+ 1;/);
});

test('hand path stays: fruit from the bag still bakes on campfire stones', () => {
  // камені багаття нікуди не діваються
  assert.match(js, /FRUIT_BAKE_TIME/);
  const section = js.slice(js.indexOf('// Запікальня: мережа готує пустелю'),
    js.indexOf('// Спостерігач: мережа бачить'));
  assert.ok(section.length > 1000, 'секцію запікальні знайдено');
  // запікальня працює лише з полицею скрині, не з торбою гравця
  assert.ok(!/player\.fruit/.test(section), 'запікальня не чіпає торби');
});

test('roaster achievements are registered', () => {
  assert.match(js, /id: 'autoroast'/);
  assert.match(js, /id: 'roastworks'/);
});

test('roaster is saved and restored with the world', () => {
  assert.match(js, /roasters: \[\.\.\.roasters\.values\(\)\]/);
  assert.match(js, /savedGame\.roasters/);
});

test('controls help documents the roaster (desktop and touch)', () => {
  const entries = html.match(/Запікальня/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
