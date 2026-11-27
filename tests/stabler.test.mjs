import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('stabler is wired into every machine guard chain next to herders', () => {
  const hrdChains = (js.match(/!?herders\.has\(/g) || []).length;
  const stbChains = (js.match(/!?stablers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про скотарів, має знати і про конюших
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(stbChains >= hrdChains - 8,
    `stablers.has: ${stbChains}, herders.has: ${hrdChains}`);
});

test('stabler ticks with the other machines after the herders', () => {
  assert.match(js, /updateHerders\(dt\);[\s\S]{0,400}updateStablers\(dt\);/);
});

test('the follow step is shared between the leash, the herder and the stabler', () => {
  // покликаний конюшим іде ТИМ САМИМ followStep, що й на повідці та в
  // скотаря — спільна гілка поклику дивиться в обидва реєстри
  assert.match(js,
    /a\.lureKey && \(herders\.has\(a\.lureKey\) \|\| stablers\.has\(a\.lureKey\)\)[\s\S]{0,200}const h = herders\.get\(a\.lureKey\) \|\| stablers\.get\(a\.lureKey\);[\s\S]{0,100}followStep\(a, h\.x \+ 0\.5, h\.z \+ 0\.5, HERDER_ARRIVE\);/);
  // окремого ходу слідування не існує: крок живе лише в followStep
  const steps = (js.match(/a\.targetYaw = Math\.atan2\(a\.pos\.x - tx, a\.pos\.z - tz\);/g) || []);
  assert.equal(steps.length, 1);
});

test('the taming heart is shared between the hand and the stabler', () => {
  // спільне серце приручення, виділене з руки
  assert.match(js, /function horseTameCore\(h\) \{/);
  // рука платить порцією їжі з торби і кличе те саме серце
  assert.match(js,
    /function feedHorseEntity\(h\) \{[\s\S]{0,900}horseTameCore\(h\);/);
  // конюший платить колоском з полиці і кличе те саме серце
  assert.match(js,
    /function stablerFeed\(s, key, h\) \{[\s\S]{0,900}const tamedNow = horseTameCore\(h\);/);
  // лічба порцій і рішення приручення живуть лише в серці: ні рука, ні
  // конюший не мають власного шляху приручення (h.tamed = true поза
  // серцем лишається тільки у відновленні зі збереження)
  const tames = (js.match(/h\.fedCount\+\+;/g) || []);
  assert.equal(tames.length, 1);
  const tameRolls =
    (js.match(/h\.fedCount >= 3 \|\| Math\.random\(\) < HORSE_TAME_CHANCE/g) || []);
  assert.equal(tameRolls.length, 1);
});

test('hand and machine portions add up in the same count', () => {
  // та сама лічба h.fedCount: третя порція приручує напевно, до того —
  // той самий шанс
  assert.match(js,
    /function horseTameCore\(h\) \{[\s\S]{0,600}if \(h\.fedCount >= 3 \|\| Math\.random\(\) < HORSE_TAME_CHANCE\) \{/);
});

test('the portion is atomic: shelf, horse and saddle are rechecked at the feeding moment', () => {
  // кінь приручений, загинув чи сідло вже не порожнє — порція не марнується
  assert.match(js,
    /function stablerFeed\(s, key, h\) \{\s*\n\s*if \(h\.tamed \|\| h\.health <= 0 \|\| stablerMountAlive\(\)\) \{\s*\n\s*h\.lureKey = null;/);
  // зерно скінчилось — кінь знову блукає, нічого не списується
  assert.match(js,
    /function stablerFeed\(s, key, h\) \{[\s\S]{0,600}const chest = stablerGrain\(s\);\s*\n\s*if \(!chest\) \{\s*\n\s*h\.lureKey = null;\s*\n\s*return;\s*\n\s*\}\s*\n\s*chest\.store\.wheat--;/);
});

test('while the mount is alive the hitching post rests', () => {
  assert.match(js,
    /function stablerTarget\(s\) \{\s*\n\s*if \(stablerMountAlive\(\)\) return null;/);
  assert.match(js,
    /function stablerMountAlive\(\) \{[\s\S]{0,200}a\.type === 'horse' && a\.tamed && a\.health > 0/);
});

test('the call is atomic: target is rechecked at the calling moment', () => {
  assert.match(js,
    /const t2 = stablerTarget\(s\);\s*\n\s*if \(t2\) \{\s*\n\s*t2\.horse\.lureKey = key;/);
});

test('only a wild grown horse within reach is called', () => {
  assert.match(js, /const STABLER_REACH = 24;/);
  assert.match(js,
    /function stablerWildHorse\(s\) \{[\s\S]{0,300}if \(a\.type !== 'horse' \|\| a\.tamed \|\| a\.baby \|\| a\.health <= 0\) continue;/);
  // не на повідці, не покликаний іншим, не сполоханий
  assert.match(js,
    /function stablerWildHorse\(s\) \{[\s\S]{0,400}if \(a\.leashed \|\| a\.lureKey \|\| a\.lureShyT > 0\) continue;/);
});

test('one stabler never steals another machine\'s call', () => {
  // покликаного одним другий не кличе: lureKey бачать і скотарі, і конюші
  assert.match(js,
    /function stablerLured\(key\) \{[\s\S]{0,200}if \(a\.lureKey === key && a\.health > 0\) return a;/);
});

test('the hand is stronger than the call', () => {
  // узятий на повідець чи приручений кимось — вуздечка відпускає
  assert.match(js,
    /if \(lured\.leashed \|\| lured\.tamed \|\| stablerMountAlive\(\)\) \{\s*\n\s*lured\.lureKey = null;/);
});

test('a called horse never despawns on the way', () => {
  assert.match(js,
    /if \(!a\.tamed && !a\.leashed &&\s*\n\s*!\(a\.lureKey && \(herders\.has\(a\.lureKey\) \|\| stablers\.has\(a\.lureKey\)\)\) &&/);
});

test('a stalled walk is released and the horse grazes shy for a while', () => {
  assert.match(js, /const STABLER_STALL = 12;/);
  assert.match(js, /const STABLER_SHY = 30;/);
  assert.match(js,
    /if \(s\.stallT >= STABLER_STALL\) \{\s*\n\s*lured\.lureKey = null;\s*\n\s*lured\.lureShyT = STABLER_SHY;/);
});

test('a stale call releases itself', () => {
  // конюшого розібрано — кінь знову сам собі (той самий тик тварини,
  // що й у скотаря)
  assert.match(js,
    /if \(a\.lureKey && !herders\.has\(a\.lureKey\) && !stablers\.has\(a\.lureKey\)\) a\.lureKey = null;/);
});

test('stabler waits idle without power and releases the called horse', () => {
  assert.match(js,
    /const on = stablerPowered\(s\);[\s\S]{0,400}if \(!on\) \{[\s\S]{0,200}if \(lured\) lured\.lureKey = null;\s*\n\s*s\.callWorkT = 0;/);
});

test('grain comes from the fullest chest shelf adjacent (diagonals too)', () => {
  assert.match(js,
    /function stablerGrain\(s\) \{[\s\S]{0,400}Math\.abs\(ch\.x - s\.x\) > 1 \|\| Math\.abs\(ch\.y - s\.y\) > 1 \|\|\s*\n\s*Math\.abs\(ch\.z - s\.z\) > 1/);
  assert.match(js,
    /function stablerGrain\(s\) \{[\s\S]{0,600}const n = ch\.store\.wheat \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('stabler achievements are registered', () => {
  assert.match(js, /id: 'autostable'/);
  assert.match(js, /id: 'remount'/);
  assert.match(js, /const STABLER_PAIR_N = 2;/);
  assert.match(js, /if \(s\.tamedN >= STABLER_PAIR_N\) unlockAch\('remount'\);/);
});

test('stabler counts tamed mounts', () => {
  assert.match(js,
    /if \(tamedNow\) \{\s*\n\s*h\.lureKey = null;\s*\n\s*s\.tamedN = \(s\.tamedN \| 0\) \+ 1;\s*\n\s*unlockAch\('autostable'\);/);
});

test('stabler is saved and restored with the world', () => {
  assert.match(js,
    /stablers: \[\.\.\.stablers\.values\(\)\]\.map\(\(s\) =>\s*\n\s*\[s\.x, s\.y, s\.z, s\.tamedN \| 0\]\)/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.stablers\)\) \{[\s\S]{0,200}addStabler\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('stabler status tooltip and dismantle are wired', () => {
  assert.match(js, /Конюший: приручено \$\{si\.tamedN \| 0\}/);
  assert.match(js, /if \(stablers\.has\(key\)\) \{\s*\n\s*breakStabler\(key\);/);
});

test('stabler appears in both control guides and the menu', () => {
  assert.match(html, /🐴 Конюший \(меню\)/);
  assert.match(html, /🐴 Конюший \(меню ▤\)/);
  assert.match(js, /\[STABLER\]: 'Конюший',/);
  assert.match(js, /TAMER, HERDER, STABLER, CHEESEMAKER, OBSERVER/);
});

test('debug helpers for the stabler exist', () => {
  assert.match(js, /giveStabler: \(\) => \{ assignBlockToSlot\(STABLER\);/);
  assert.match(js, /placeStablerAt: \(x, y, z\) => \{/);
  assert.match(js, /stablerFast: \(\) => \{/);
  assert.match(js, /spawnWildHorseAt: \(x, y, z\) => \{/);
  assert.match(js, /smiteHorses: \(\) => \{/);
  assert.match(js, /get stablerInfo\(\) \{/);
});

test('the mechanic remembers the stabler (iron scar registry)', () => {
  assert.match(js,
    /stabler:\s*\{ map: \(\) => stablers,\s*args: \(e\) => \[e\.tamedN \| 0\],\s*\n\s*make: \(x, y, z, a\) => addStabler\(x, y, z, a\[0\] \| 0\) \},/);
});
