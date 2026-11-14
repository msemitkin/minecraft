import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('collier is wired into every machine guard chain next to foresters', () => {
  const frsChains = (js.match(/!?foresters\.has\(/g) || []).length;
  const clrChains = (js.match(/!?colliers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про лісничих, має знати і про вуглежогів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(clrChains >= frsChains - 8,
    `colliers.has: ${clrChains}, foresters.has: ${frsChains}`);
});

test('collier ticks with the other machines after the foresters', () => {
  assert.match(js, /updateForesters\(dt\);[\s\S]{0,400}updateColliers\(dt\);/);
});

test('collier needs a chest with timber and shelf space for coal', () => {
  // скриня впритул береться лише з колодами і місцем на полиці вугілля
  assert.match(js, /\(ch\.store\.timber \|\| 0\) >= 1 && \(ch\.store\.coal \|\| 0\) < CHEST_STACK/);
  // без скрині чи без колод — жар жевріє дарма
  assert.match(js, /const chest = collierChest\(c\);/);
});

test('collier swap is atomic at the moment of charring (nothing to lose)', () => {
  // обмін відбувається всередині collierFinish — зламаний вуглежог нічого не губить
  assert.match(js, /function collierFinish\(c, chest\)/);
  assert.match(js, /chest\.store\.timber -= 1;\s*\n\s*chest\.store\.coal = \(chest\.store\.coal \|\| 0\) \+ 1;/);
  assert.match(js, /c\.charred = \(c\.charred \| 0\) \+ 1;/);
});

test('collier coal is the very same good as mined coal (shared shelf kind)', () => {
  // вугілля вже крам скрині (той самий ключ coal, що й з кирки) — кузня,
  // гарт і стрілець беруть його, не знаючи, звідки воно
  assert.match(js, /coal:\s*\{ icon: '⚫', name: 'вугілля',\s*max: ORE_MAX\.coal \}/);
  // поповнена полиця оновлює ту саму плашку HUD руди
  assert.match(js, /updateChestKindHud\('coal'\);/);
});

test('collier waits idle without power or without a chest', () => {
  // без живлення жар гасне, без скрині лічильник роботи не тікає
  assert.match(js, /function collierPowered\(c\)/);
  assert.match(js, /if \(!on\) continue;\s*\n\s*const chest = collierChest\(c\);\s*\n\s*if \(!chest\) continue;/);
});

test('collier achievements are registered', () => {
  assert.match(js, /id: 'autochar'/);
  assert.match(js, /id: 'charworks'/);
});

test('collier is saved and restored with the world', () => {
  assert.match(js, /colliers: \[\.\.\.colliers\.values\(\)\]/);
  assert.match(js, /savedGame\.colliers/);
});

test('controls help documents the collier (desktop and touch)', () => {
  const entries = html.match(/Вуглежог/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
