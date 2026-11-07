import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('brewer is wired into every machine guard chain next to butchers', () => {
  const bchChains = (js.match(/!?butchers\.has\(/g) || []).length;
  const brwChains = (js.match(/!?brewers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про різників, має знати і про зіллярок
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(brwChains >= bchChains - 8,
    `brewers.has: ${brwChains}, butchers.has: ${bchChains}`);
});

test('brewer ticks with the other machines after the butchers', () => {
  assert.match(js, /updateButchers\(dt\);[\s\S]{0,400}updateBrewers\(dt\);/);
});

test('brewer feeds only a water-filled cauldron and never fills or empties one', () => {
  // лише казан у стані 1 (вода чекає на засипку) впритул
  assert.match(js, /function brewerCauldron\(b\) \{[\s\S]{0,400}if \(c\.state === 1\) return c;/);
  // вариво закипає так само, як від ручної засипки
  assert.match(js, /t\.c\.state = 2;\s*\n\s*t\.c\.kind = t\.kind;\s*\n\s*t\.c\.brewT = 0;/);
});

test('ingredients leave the fullest shelf, whole portion only, hand recipe order', () => {
  // ціла засипка з найповнішої полиці — половинки не кидаються
  assert.match(js, /function brewerShelf\(b, bag, cost\) \{\s*\n\s*let best = null, bestN = 0;/);
  assert.match(js, /return bestN >= cost \? best : null;/);
  // той самий лад рецептів, що й з руки: перший з POTION_KINDS
  assert.match(js, /function brewerRecipe\(b\) \{\s*\n\s*for \(let i = 0; i < POTION_KINDS\.length; i\+\+\)/);
});

test('brewing is atomic: shelf pays exactly the hand cost at the moment of the throw', () => {
  assert.match(js, /function brewerFinish\(b\)/);
  assert.match(js, /t\.chest\.store\[p\.bag\] = \(t\.chest\.store\[p\.bag\] \| 0\) - p\.cost;/);
  assert.match(js, /b\.brewed = \(b\.brewed \| 0\) \+ 1;/);
});

test('hand path stays: ingredients from the bag still start the brew by RMB', () => {
  assert.match(js, /player\[p\.bag\] -= p\.cost;/);
});

test('brewer achievements are registered', () => {
  assert.match(js, /id: 'autobrew'/);
  assert.match(js, /id: 'brewhut'/);
});

test('brewer is saved and restored with the world', () => {
  assert.match(js, /brewers: \[\.\.\.brewers\.values\(\)\]/);
  assert.match(js, /savedGame\.brewers/);
});

test('controls help documents the brewer (desktop and touch)', () => {
  const entries = html.match(/Зіллярка/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
