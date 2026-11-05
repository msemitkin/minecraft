import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('kennel is wired into every machine guard chain next to miners', () => {
  const mnrChains = (js.match(/!?miners\.has\(/g) || []).length;
  const knlChains = (js.match(/!?kennels\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про рудокопок, має знати і про псарні
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(knlChains >= mnrChains - 8,
    `kennels.has: ${knlChains}, miners.has: ${mnrChains}`);
});

test('kennel ticks with the other machines after the miners', () => {
  assert.match(js, /updateMiners\(dt\);[\s\S]{0,400}updateKennels\(dt\);/);
});

test('kennel feeds only a wounded TAMED wolf within reach', () => {
  // дикий вовк не частується — приручення лишається рукам
  assert.match(js, /if \(a\.type !== 'wolf' \|\| !a\.tamed \|\| a\.health <= 0\) continue;/);
  // здоровий недоторканний: бракує щонайменше пів порції здоров'я
  assert.match(js, /a\.health > a\.maxHealth - WOLF_HEAL_PER_FEED \/ 2/);
  // сяг псарні обмежений
  assert.match(js, /const KENNEL_REACH = 4;/);
});

test('meat comes from the fullest shelf of the chest beside the kennel', () => {
  assert.match(js, /function kennelMeat\(p\) \{\s*\n\s*let best = null, bestN = 0;/);
  assert.match(js, /const n = ch\.store\.food \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('feeding is atomic: same portion as the hand, nothing lost in transit', () => {
  // та сама порція, що й з руки по ПКМ — WOLF_HEAL_PER_FEED
  assert.match(js, /function kennelFinish\(p, wolf, chest\)/);
  assert.match(js, /if \(\(chest\.store\.food \| 0\) < 1\) return;/);
  assert.match(js, /if \(!wolf\.tamed \|\| wolf\.health <= 0 \|\| wolf\.health >= wolf\.maxHealth\) return;/);
  assert.match(js, /chest\.store\.food -= 1;\s*\n\s*wolf\.health = Math\.min\(wolf\.maxHealth, wolf\.health \+ WOLF_HEAL_PER_FEED\);/);
  assert.match(js, /p\.fed = \(p\.fed \| 0\) \+ 1;/);
});

test('hand path stays: wolves are still fed by RMB from the bag', () => {
  assert.match(js, /function feedWolfEntity\(w\)/);
  assert.match(js, /w\.health = Math\.min\(w\.maxHealth, w\.health \+ WOLF_HEAL_PER_FEED\);/);
});

test('kennel achievements are registered', () => {
  assert.match(js, /id: 'autowolf'/);
  assert.match(js, /id: 'packden'/);
});

test('kennel is saved and restored with the world', () => {
  assert.match(js, /kennels: \[\.\.\.kennels\.values\(\)\]/);
  assert.match(js, /savedGame\.kennels/);
});

test('controls help documents the kennel (desktop and touch)', () => {
  const entries = html.match(/Псарня/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
