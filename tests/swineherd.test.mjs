import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('swineherd is wired into every machine guard chain next to waterbearers', () => {
  const wbrChains = (js.match(/!?waterbearers\.has\(/g) || []).length;
  const swhChains = (js.match(/!?swineherds\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про водоносів, має знати і про свинопасів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(swhChains >= wbrChains - 8,
    `swineherds.has: ${swhChains}, waterbearers.has: ${wbrChains}`);
});

test('swineherd ticks with the other machines after the waterbearers', () => {
  assert.match(js, /updateWaterbearers\(dt\);[\s\S]{0,400}updateSwineherds\(dt\);/);
});

test('swineherd hires only a grown free pig: no leash, no baby, no love', () => {
  // повід сильніший за ґирлиґу, маля не наймається, закохана теж
  assert.match(js, /function swineherdCanHire\(a\) \{[\s\S]{0,300}!a\.baby && !a\.leashed &&[\s\S]{0,100}!\(a\.love > 0\)/);
});

test('hired pig digs by the same move as the leashed one', () => {
  // той самий нюх updateTrufflePig — і на повідці, і в наймах
  assert.match(js, /a\.type === 'pig' && a\.herdKey && updateTrufflePig\(a, dt\)/);
  // поводир найнятої — тумба свинопаса, а не гравець
  assert.match(js, /const sh = !a\.leashed && a\.herdKey \? swineherds\.get\(a\.herdKey\) : null;/);
});

test('truffle lands on the ground exactly as from the hand walk', () => {
  // dropTruffle — один на обидва шляхи: земля, звідти нога чи збирач
  assert.match(js, /function updateTrufflePig\(a, dt\) \{[\s\S]{0,2500}dropTruffle\(sx, a\.digSpot\.y, sz\);/);
  const drops = (js.match(/dropTruffle\(/g) || []).length;
  assert.ok(drops >= 2, `dropTruffle згадок: ${drops}`);
});

test('exchange is atomic: credit grows only at the moment of digging out', () => {
  assert.match(js, /if \(a\.herdKey\) swineherdCredit\(a\);/);
  assert.match(js, /sh\.found = \(sh\.found \| 0\) \+ 1;/);
  // відпускання нічого не губить — риття просто скасовується
  assert.match(js, /function swineherdRelease\(sh\) \{[\s\S]{0,300}cancelDig\(pig\);/);
});

test('hand path stays: the leash still walks the pig and takes priority', () => {
  assert.match(js, /function tryLeashAnimal\(\)/);
  // повід сильніший за ґирлиґу: при взятті на повід найми скидаються
  assert.match(js, /a\.leashed = true;[\s\S]{0,200}a\.herdKey = null;/);
  // ручне досягнення лишається за повідцем
  assert.match(js, /else unlockAch\('truffle'\);/);
});

test('swineherd achievements are registered', () => {
  assert.match(js, /id: 'autotruffle'/);
  assert.match(js, /id: 'trufflefarm'/);
});

test('swineherd is saved and restored with the world', () => {
  assert.match(js, /swineherds: \[\.\.\.swineherds\.values\(\)\]/);
  assert.match(js, /savedGame\.swineherds/);
});

test('controls help documents the swineherd (desktop and touch)', () => {
  const entries = html.match(/Свинопас/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
