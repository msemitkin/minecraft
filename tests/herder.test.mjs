import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('herder is wired into every machine guard chain next to tamers', () => {
  const tamChains = (js.match(/!?tamers\.has\(/g) || []).length;
  const hrdChains = (js.match(/!?herders\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про ловчих, має знати і про скотарів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(hrdChains >= tamChains - 8,
    `herders.has: ${hrdChains}, tamers.has: ${tamChains}`);
});

test('herder ticks with the other machines after the tamers', () => {
  assert.match(js, /updateTamers\(dt\);[\s\S]{0,300}updateHerders\(dt\);/);
});

test('the follow step is shared between the leash and the herder call', () => {
  // спільний крок слідування, виділений з гілки повідця
  assert.match(js, /function followStep\(a, tx, tz, minD\) \{/);
  // повідець веде тим самим кроком
  assert.match(js,
    /followStep\(a, player\.pos\.x, player\.pos\.z, LEASH_FOLLOW_MIN\);/);
  // покликана скотарем (чи конюшим) іде тим самим кроком до корита
  assert.match(js,
    /a\.lureKey && \(herders\.has\(a\.lureKey\) \|\| stablers\.has\(a\.lureKey\)\)[\s\S]{0,400}followStep\(a, h\.x \+ 0\.5, h\.z \+ 0\.5, HERDER_ARRIVE\);/);
  // окремого ходу слідування не існує: крок живе лише в followStep
  const steps = (js.match(/a\.targetYaw = Math\.atan2\(a\.pos\.x - tx, a\.pos\.z - tz\);/g) || []);
  assert.equal(steps.length, 1);
});

test('the feed heart is shared between the hand, the feeder and the herder', () => {
  // спільне серце частування, виділене з руки й годівниці
  assert.match(js, /function farmFeedCore\(a, netFed\) \{/);
  // рука платить їжею з торби і кличе те саме серце (частунок не мережевий)
  assert.match(js,
    /player\.food--;\s*\n\s*updateFoodHud\(\);\s*\n\s*farmFeedCore\(a, false\);/);
  // годівниця платить колоском з полиці і кличе те саме серце
  assert.match(js,
    /function feederServe\(f\) \{[\s\S]{0,900}farmFeedCore\(a, true\);/);
  // скотар біля корита кличе те саме серце (частунок мережевий)
  assert.match(js,
    /function herderFinish\(h, a\) \{[\s\S]{0,900}farmFeedCore\(a, true\);/);
  // «настрій» дорослої в ігровому ході живе лише в серці: ні рука, ні
  // годівниця, ні скотар не мають власного шляху частування
  assert.doesNotMatch(js,
    /function tryFeedFarmAnimal\(\) \{[\s\S]{0,1400}?a\.love = LOVE_TIME/);
  assert.doesNotMatch(js,
    /function feederServe\(f\) \{[\s\S]{0,900}?a\.love = LOVE_TIME/);
  assert.doesNotMatch(js,
    /function herderFinish\(h, a\) \{[\s\S]{0,900}?a\.love = LOVE_TIME/);
});

test('the treat obeys the same gates as the hand and the feeder', () => {
  // сита, перепочиває чи загін переповнений — зерно лишається на полиці
  assert.match(js,
    /function herderFinish\(h, a\) \{[\s\S]{0,600}if \(chest && !a\.baby && a\.love <= 0 && a\.breedCd <= 0 &&\s*\n\s*animals\.length < BREED_ANIMAL_CAP\) \{/);
  // і лише тоді колосок сходить з полиці
  assert.match(js,
    /function herderFinish\(h, a\) \{[\s\S]{0,900}chest\.store\.wheat--;/);
});

test('while the yard is full the crook rests', () => {
  // повний двір — ціль не шукається
  assert.match(js,
    /function herderTarget\(h\) \{\s*\n\s*if \(herderYardCount\(h\) >= HERDER_FULL_N\) return null;/);
  assert.match(js, /const HERDER_FULL_N = 4;/);
  assert.match(js, /const HERDER_WATCH_R = 10;/);
});

test('the call is atomic: target is rechecked at the calling moment', () => {
  assert.match(js,
    /const t2 = herderTarget\(h\);\s*\n\s*if \(t2\) \{\s*\n\s*t2\.wild\.lureKey = key;/);
});

test('only a wild grown farm animal within reach is called', () => {
  assert.match(js, /const HERDER_REACH = 24;/);
  assert.match(js,
    /function herderWild\(h\) \{[\s\S]{0,300}if \(!BREED_TYPES\.has\(a\.type\) \|\| a\.baby \|\| a\.health <= 0\) continue;/);
  // не на повідці, не наймичка свинопаса, не покликана іншим скотарем
  assert.match(js,
    /function herderWild\(h\) \{[\s\S]{0,400}if \(a\.leashed \|\| a\.herdKey \|\| a\.lureKey \|\| a\.lureShyT > 0\) continue;/);
});

test('one herder never steals another herder\'s call', () => {
  // покликану одним другий не кличе: lureKey бачать усі скотарі
  assert.match(js,
    /function herderLured\(key\) \{[\s\S]{0,200}if \(a\.lureKey === key && a\.health > 0\) return a;/);
});

test('the hand is stronger than the call', () => {
  // узята на повідець — ґирлиґа відпускає
  assert.match(js,
    /if \(lured\.leashed\) \{\s*\n\s*lured\.lureKey = null;/);
  // гілка повідця в updateAnimal стоїть перед гілкою поклику
  const leashIdx = js.indexOf('} else if (a.leashed) {');
  const lureIdx = js.indexOf('} else if (a.lureKey && (herders.has(a.lureKey) || stablers.has(a.lureKey))) {');
  assert.ok(leashIdx > 0 && lureIdx > leashIdx);
});

test('a called animal never despawns on the way', () => {
  assert.match(js,
    /if \(!a\.tamed && !a\.leashed &&\s*\n\s*!\(a\.lureKey && \(herders\.has\(a\.lureKey\) \|\| stablers\.has\(a\.lureKey\)\)\) &&/);
});

test('a stalled walk is released and the animal grazes shy for a while', () => {
  assert.match(js, /const HERDER_STALL = 12;/);
  assert.match(js, /const HERDER_SHY = 30;/);
  // без поступу ґирлиґа відпускає, сполохана перепасається
  assert.match(js,
    /if \(h\.stallT >= HERDER_STALL\) \{\s*\n\s*lured\.lureKey = null;\s*\n\s*lured\.lureShyT = HERDER_SHY;/);
  // сполохану в сягу не кличуть, поки не заспокоїться
  assert.match(js,
    /if \(a\.leashed \|\| a\.herdKey \|\| a\.lureKey \|\| a\.lureShyT > 0\) continue;/);
  // спокій вертається сам (тик тварини)
  assert.match(js, /if \(a\.lureShyT > 0\) a\.lureShyT -= dt;/);
});

test('a stale call releases itself', () => {
  // скотаря (чи конюшого) розібрано — тварина знову сама собі
  assert.match(js,
    /if \(a\.lureKey && !herders\.has\(a\.lureKey\) && !stablers\.has\(a\.lureKey\)\) a\.lureKey = null;/);
});

test('herder waits idle without power and releases the called animal', () => {
  assert.match(js,
    /const on = herderPowered\(h\);[\s\S]{0,400}if \(!on\) \{[\s\S]{0,200}if \(lured\) lured\.lureKey = null;\s*\n\s*h\.callWorkT = 0;/);
});

test('grain comes from the fullest chest shelf adjacent (diagonals too)', () => {
  assert.match(js,
    /function herderGrain\(h\) \{[\s\S]{0,400}Math\.abs\(ch\.x - h\.x\) > 1 \|\| Math\.abs\(ch\.y - h\.y\) > 1 \|\|\s*\n\s*Math\.abs\(ch\.z - h\.z\) > 1/);
  assert.match(js,
    /function herderGrain\(h\) \{[\s\S]{0,600}const n = ch\.store\.wheat \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('herder achievements are registered', () => {
  assert.match(js, /id: 'autoherd'/);
  assert.match(js, /id: 'herdyard'/);
  assert.match(js, /const HERDER_YARD_N = 3;/);
  assert.match(js, /if \(h\.herdedN >= HERDER_YARD_N\) unlockAch\('herdyard'\);/);
});

test('herder counts arrivals at the trough', () => {
  assert.match(js,
    /function herderFinish\(h, a\) \{\s*\n\s*a\.lureKey = null;[\s\S]{0,200}h\.herdedN = \(h\.herdedN \| 0\) \+ 1;\s*\n\s*unlockAch\('autoherd'\);/);
});

test('herder is saved and restored with the world', () => {
  assert.match(js,
    /herders: \[\.\.\.herders\.values\(\)\]\.map\(\(h\) =>\s*\n\s*\[h\.x, h\.y, h\.z, h\.herdedN \| 0\]\)/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.herders\)\) \{[\s\S]{0,200}addHerder\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('herder status tooltip and dismantle are wired', () => {
  assert.match(js, /Скотар: приведено \$\{hi\.herdedN \| 0\}/);
  assert.match(js, /if \(herders\.has\(key\)\) \{\s*\n\s*breakHerder\(key\);/);
});

test('herder appears in both control guides and the menu', () => {
  assert.match(html, /🐮 Скотар \(меню\)/);
  assert.match(html, /🐮 Скотар \(меню ▤\)/);
  assert.match(js, /\[HERDER\]: 'Скотар',/);
  assert.match(js, /TAMER, HERDER, STABLER, OBSERVER/);
});

test('debug helpers for the herder exist', () => {
  assert.match(js, /giveHerder: \(\) => \{ assignBlockToSlot\(HERDER\);/);
  assert.match(js, /placeHerderAt: \(x, y, z\) => \{/);
  assert.match(js, /herderFast: \(\) => \{/);
  assert.match(js, /spawnWildAnimalAt: \(type, x, y, z\) => \{/);
  assert.match(js, /get herderInfo\(\) \{/);
});

test('the mechanic remembers the herder (iron scar registry)', () => {
  assert.match(js,
    /herder:\s*\{ map: \(\) => herders,\s*args: \(e\) => \[e\.herdedN \| 0\],\s*\n\s*make: \(x, y, z, a\) => addHerder\(x, y, z, a\[0\] \| 0\) \},/);
});
