import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('cupbearer is wired into every machine guard chain next to brewers', () => {
  const brwChains = (js.match(/!?brewers\.has\(/g) || []).length;
  const cpbChains = (js.match(/!?cupbearers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про зіллярок, має знати і про чашників
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(cpbChains >= brwChains - 8,
    `cupbearers.has: ${cpbChains}, brewers.has: ${brwChains}`);
});

test('cupbearer ticks with the other machines after the brewers', () => {
  assert.match(js, /updateBrewers\(dt\);[\s\S]{0,400}updateCupbearers\(dt\);/);
});

test('cupbearer serves only a ready cauldron whose effect is not already running', () => {
  // лише казан у стані 3 (готове зілля) впритул — воду й вариво не чіпає
  assert.match(js, /function cupbearerCauldron\(cb\) \{[\s\S]{0,500}if \(c\.state !== 3\) continue;/);
  // ні краплі не марнується: поки дія ще йде, казан цього зілля минається
  assert.match(js, /if \(player\[EFFECT_FIELD\[POTION_KINDS\[c\.kind\]\.key\]\] > 0\) continue;/);
});

test('serving matches the hand sip: same duration, same tasted mark, cauldron empties', () => {
  assert.match(js, /function cupbearerFinish\(cb\)/);
  // та сама дія, що й ковток по ПКМ
  assert.match(js, /function cupbearerFinish\(cb\) \{[\s\S]{0,700}player\[EFFECT_FIELD\[p\.key\]\] = p\.dur;/);
  assert.match(js, /function cupbearerFinish\(cb\) \{[\s\S]{0,700}player\.potTasted \|= 1 << c\.kind;/);
  // казан порожніє, як від ковтка
  assert.match(js, /function cupbearerFinish\(cb\) \{[\s\S]{0,900}c\.state = 0;\s*\n\s*c\.rainT = 0;/);
});

test('exchange is atomic: served counter grows only at the moment of serving', () => {
  assert.match(js, /cb\.served = \(cb\.served \| 0\) \+ 1;/);
  // мертвому кухоль не подає
  assert.match(js, /function cupbearerPatron\(cb\) \{\s*\n\s*if \(player\.dead\) return false;/);
});

test('hand path stays: the ready potion is still drunk from the cauldron by RMB', () => {
  assert.match(js, /function drinkFromCauldron\(c\)/);
  assert.match(js, /if \(c\.state === 3\) \{ drinkFromCauldron\(c\); return true; \}/);
});

test('cupbearer achievements are registered', () => {
  assert.match(js, /id: 'autopour'/);
  assert.match(js, /id: 'tavern'/);
});

test('cupbearer is saved and restored with the world', () => {
  assert.match(js, /cupbearers: \[\.\.\.cupbearers\.values\(\)\]/);
  assert.match(js, /savedGame\.cupbearers/);
});

test('controls help documents the cupbearer (desktop and touch)', () => {
  const entries = html.match(/Чашник/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
