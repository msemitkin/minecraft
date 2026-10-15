import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

// Регресія вади пріоритету операторів: у ланцюжках перевірки вільної
// клітинки `&& !a.has(k) || b.has(k) &&` через пріоритет `&&` над `||`
// зникали перевірки після `||` — усі машини мають стояти однорідним
// ланцюжком `&&`
test('placement guards keep a uniform && chain (no || precedence bug)', () => {
  assert.doesNotMatch(js, /!\w+\.has\(k\) \|\| \w+\.has\(k\) &&/);
});

test('extractor is wired into every machine guard chain next to bakers', () => {
  const bakerChains = (js.match(/!?bakers\.has\(/g) || []).length;
  const extractorChains = (js.match(/!?extractors\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про печі, має знати і про медогонки
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(extractorChains >= bakerChains - 8,
    `extractors.has: ${extractorChains}, bakers.has: ${bakerChains}`);
});

test('extractor achievements are registered', () => {
  assert.match(js, /id: 'autohoney'/);
  assert.match(js, /id: 'honeyworks'/);
});

test('extractor is saved and restored with the world', () => {
  assert.match(js, /extractors: \[\.\.\.extractors\.values\(\)\]/);
  assert.match(js, /savedGame\.extractors/);
});

test('controls help documents the extractor (desktop and touch)', () => {
  const entries = html.match(/Медогонка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
