import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('steamer is wired into every machine guard chain next to dredges', () => {
  const dredgeChains = (js.match(/!?dredges\.has\(/g) || []).length;
  const steamerChains = (js.match(/!?steamers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про драги, має знати і про парні
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(steamerChains >= dredgeChains - 8,
    `steamers.has: ${steamerChains}, dredges.has: ${dredgeChains}`);
});

test('steamer ticks with the other machines after the dredges', () => {
  assert.match(js, /updateDredges\(dt\);[\s\S]{0,400}updateSteamers\(dt\);/);
});

test('steamer needs a chest with raw oysters and shelf space for mollusk meat', () => {
  // скриня впритул береться лише з устрицями і місцем на полиці м'яса
  assert.match(js, /\(ch\.store\.oyster \| 0\) >= 1 && \(ch\.store\.mollusk \| 0\) < CHEST_STACK/);
  // без скрині — казан париться дарма
  assert.match(js, /const chest = steamerChest\(st\);/);
});

test('steamer exchange is atomic at the moment of readiness (nothing to lose)', () => {
  // устриця стає м'ясом молюска всередині steamerFinish —
  // зламана парня нічого не губить
  assert.match(js, /function steamerFinish\(st, chest\)/);
  assert.match(js, /chest\.store\.oyster -= 1;\s*\n\s*chest\.store\.mollusk = \(chest\.store\.mollusk \| 0\) \+ 1;/);
  assert.match(js, /st\.opened = \(st\.opened \| 0\) \+ 1;/);
});

test('steamer never yields pearls — pearls stay with hand steaming', () => {
  // у секції парні немає ані перлин, ані їхнього лічильника удачі
  const section = js.slice(js.indexOf('// Парня: мережа розкриває мушлі'),
    js.indexOf('// Спостерігач: мережа бачить'));
  assert.ok(section.length > 1000, 'секцію парні знайдено');
  assert.ok(!/pearl/i.test(section), 'парня не чіпає перлин');
});

test('steamer achievements are registered', () => {
  assert.match(js, /id: 'autosteam'/);
  assert.match(js, /id: 'steamworks'/);
});

test('steamer is saved and restored with the world', () => {
  assert.match(js, /steamers: \[\.\.\.steamers\.values\(\)\]/);
  assert.match(js, /savedGame\.steamers/);
});

test('controls help documents the steamer (desktop and touch)', () => {
  const entries = html.match(/Парня/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
