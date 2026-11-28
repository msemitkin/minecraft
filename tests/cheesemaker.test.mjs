import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');

test('cheesemaker is wired into every machine guard chain next to stablers', () => {
  const stbChains = (js.match(/!?stablers\.has\(/g) || []).length;
  const chmChains = (js.match(/!?cheesemakers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про конюших, має знати і про сироварів
  // (власні секції машин дають кожній кілька додаткових згадок, а
  // сировар не кличе — гілки поклику лишаються конюшим і скотарям)
  assert.ok(chmChains >= stbChains - 8,
    `cheesemakers.has: ${chmChains}, stablers.has: ${stbChains}`);
});

test('cheesemaker ticks with the other machines after the stablers', () => {
  assert.match(js, /updateStablers\(dt\);[\s\S]{0,400}updateCheesemakers\(dt\);/);
});

test('the milking heart is shared between the bucket, the milkmaid and the cheesemaker', () => {
  // спільне серце доїння, виділене з руки й доярки
  assert.match(js, /function cowMilkCore\(cow\) \{\s*\n\s*if \(cow\.milkTimer > 0\) return false;\s*\n\s*cow\.milkTimer = MILK_COOLDOWN;/);
  // відро з руки кличе те саме серце
  assert.match(js, /function milkCowEntity\(cow\) \{\s*\n\s*if \(!cowMilkCore\(cow\)\) \{/);
  // доярка кличе те саме серце
  assert.match(js, /function milkmaidFinish\(m, cow\) \{[\s\S]{0,300}if \(!cowMilkCore\(cow\)\) return;/);
  // сировар кличе те саме серце
  assert.match(js, /function cheesemakerFinish\(c, cow\) \{[\s\S]{0,400}if \(!cowMilkCore\(cow\)\) return;/);
  // надій живе лише в серці: окремого шляху доїння не існує
  const uses = (js.match(/milkTimer = MILK_COOLDOWN/g) || []).length;
  assert.equal(uses, 1, `milkTimer = MILK_COOLDOWN згадок: ${uses}`);
});

test('pressing is atomic: shelf and cow are rechecked at the finishing moment', () => {
  // корова загинула чи це телятко — нічого не списується
  assert.match(js,
    /function cheesemakerFinish\(c, cow\) \{\s*\n\s*if \(cow\.health <= 0 \|\| cow\.baby\) return;/);
  // скриню зламали по дорозі — молоко лишається в корові
  assert.match(js,
    /function cheesemakerFinish\(c, cow\) \{[\s\S]{0,200}const chest = cheesemakerChest\(c\);\s*\n\s*if \(!chest\) return;/);
  // видоїв хтось по дорозі (відро, доярка чи інший сировар) — серце
  // відмовляє, і круг не друкується з повітря
  assert.match(js,
    /if \(!cowMilkCore\(cow\)\) return;.*\n\s*chest\.store\.cheese = Math\.min\(CHEST_STACK, \(chest\.store\.cheese \| 0\) \+ 1\);/);
});

test('only a grown ready cow within the milkmaid reach is milked', () => {
  // та сама мірка, що й у доярки: 4 блоки, телятко не доїться
  assert.match(js, /const CHEESEMAKER_COW_R = 4\.0;/);
  assert.match(js,
    /function cheesemakerCow\(c, onlyReady = true\) \{[\s\S]{0,300}if \(a\.type !== 'cow' \|\| a\.baby\) continue;\s*\n\s*if \(onlyReady && a\.milkTimer > 0\) continue;/);
});

test('the milkmaid serves the hungry player first (shorter cycle)', () => {
  const milkmaidTime = +(js.match(/const MILKMAID_TIME = (\d+)/) || [])[1];
  const cheesemakerTime = +(js.match(/const CHEESEMAKER_TIME = (\d+)/) || [])[1];
  assert.ok(Number.isFinite(milkmaidTime) && Number.isFinite(cheesemakerTime));
  assert.ok(milkmaidTime < cheesemakerTime,
    `MILKMAID_TIME ${milkmaidTime} має бути меншим за CHEESEMAKER_TIME ${cheesemakerTime}`);
});

test('the wheel lands on the fullest shelf that still has room', () => {
  assert.match(js,
    /function cheesemakerChest\(c\) \{[\s\S]{0,400}const n = ch\.store\.cheese \| 0;\s*\n\s*if \(n < CHEST_STACK && n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('cheese is real food: the hand eats it in the cooked ladder', () => {
  // сир між смажениною і печенею — і в руки, і в трапезниці
  assert.match(js, /const CHEESE_FOOD = 9;/);
  assert.match(js,
    /: player\.cooked > 0 \? COOKED_FOOD\s*\n\s*: player\.cheese > 0 \? CHEESE_FOOD\s*\n\s*: player\.roast > 0 \? ROAST_FOOD/);
  assert.match(js,
    /\} else if \(player\.cheese > 0\) \{[\s\S]{0,200}player\.cheese -= 1;\s*\n\s*player\.hunger = Math\.min\(MAX_HUNGER, player\.hunger \+ CHEESE_FOOD\);/);
  // кнопка їжі бачить сир серед готових страв
  assert.match(js, /player\.cheese > 0 \|\| player\.roast > 0/);
});

test('the canteen serves cheese in the same ladder', () => {
  assert.match(js,
    /\['cooked',\s+COOKED_FOOD\],\s*\n\s*\['cheese',\s+CHEESE_FOOD\],\s*\n\s*\['roast',\s+ROAST_FOOD\],/);
});

test('cheese is a chest good with its own shelf and badge', () => {
  assert.match(js, /cheese:\s*\{ icon: '🧀', name: 'круги сиру',\s*max: CHEESE_MAX \}/);
  assert.match(js, /else if \(kind === 'cheese'\) updateCheeseHud\(\);/);
  assert.match(js, /function updateCheeseHud\(\)/);
  assert.match(js, /function drawCheeseIcon\(canvas\)/);
  assert.match(html, /id="cheese-badge"/);
  assert.match(html, /id="cheese-icon"/);
  assert.match(html, /id="cheese-count"/);
});

test('the cheese badge is styled, and the forgotten cake and timber badges got their CSS back', () => {
  // сировар приніс бейдж сиру — а заразом знайшлася й загублена
  // стилізація бейджів медяників і колод (їх забули в CSS)
  assert.match(css, /#cheese-badge,/);
  assert.match(css, /#cake-badge,/);
  assert.match(css, /#timber-badge,/);
  assert.match(css, /#cheese-badge \{\s*\n\s*bottom: \d+px;/);
  assert.match(css, /#cake-badge \{\s*\n\s*bottom: \d+px;/);
  assert.match(css, /#timber-badge \{\s*\n\s*bottom: \d+px;/);
});

test('cheese in the bag survives save and load', () => {
  assert.match(js, /cheese: player\.cheese,/);
  assert.match(js,
    /if \(Number\.isFinite\(p\.cheese\)\) \{\s*\n\s*player\.cheese = THREE\.MathUtils\.clamp\(Math\.floor\(p\.cheese\), 0, CHEESE_MAX\);/);
});

test('cheesemaker is saved and restored with the world (wheel count too)', () => {
  assert.match(js, /cheesemakers: \[\.\.\.cheesemakers\.values\(\)\]\.map\(\(c\) =>\s*\n\s*\[c\.x, c\.y, c\.z, c\.pressed \| 0\]\)/);
  assert.match(js,
    /if \(savedGame && Array\.isArray\(savedGame\.cheesemakers\)\) \{[\s\S]{0,200}addCheesemaker\(e\[0\], e\[1\], e\[2\], e\[3\] \| 0\);/);
});

test('the mechanic remembers the cheesemaker too', () => {
  assert.match(js,
    /cheesemaker: \{ map: \(\) => cheesemakers, args: \(e\) => \[e\.pressed \| 0\],\s*\n\s*make: \(x, y, z, a\) => addCheesemaker\(x, y, z, a\[0\] \| 0\) \}/);
});

test('cheesemaker has a cap so saves stay small', () => {
  assert.match(js, /const CHEESEMAKER_MAX = 32;/);
  assert.match(js, /cheesemakers\.size >= CHEESEMAKER_MAX\) return false;/);
});

test('breaking by hand and by lost support both dismantle cleanly', () => {
  assert.match(js,
    /if \(cheesemakers\.has\(key\)\) \{\s*\n\s*breakCheesemaker\(key\);\s*\n\s*triggerSwing\(\);/);
  assert.match(js,
    /function updateCheesemakers\(dt\) \{[\s\S]{0,400}if \(isSolid\(blockAt\(c\.x, c\.y, c\.z\)\) \|\| !isSolid\(blockAt\(c\.x, c\.y - 1, c\.z\)\)\) \{\s*\n\s*breakCheesemaker\(key\);/);
});

test('cheesemaker appears in both control guides and the menu', () => {
  assert.match(js, /TAMER, HERDER, STABLER, CHEESEMAKER, CARVER, OBSERVER/);
  assert.match(js, /\[CHEESEMAKER\]: 'Сировар',/);
  const guides = (html.match(/Сировар \(меню/g) || []).length;
  assert.ok(guides >= 2, `довідок із сироваром: ${guides}`);
});

test('cheesemaker achievements are registered', () => {
  assert.match(js, /id: 'autocheese'/);
  assert.match(js, /id: 'cheesery'/);
  assert.match(js, /unlockAch\('autocheese'\);/);
  assert.match(js, /if \(c\.pressed >= CHEESEMAKER_WHEELS_N\) unlockAch\('cheesery'\);/);
});

test('debug helpers for QA are exposed', () => {
  assert.match(js, /giveCheesemaker: \(\) =>/);
  assert.match(js, /placeCheesemakerAt: \(x, y, z\) =>/);
  assert.match(js, /cheeseFast: \(\) =>/);
  assert.match(js, /get cheesemakerInfo\(\)/);
});
