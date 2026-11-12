import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('lumberjack is wired into every machine guard chain next to outfitters', () => {
  const otfChains = (js.match(/!?outfitters\.has\(/g) || []).length;
  const lmbChains = (js.match(/!?lumberjacks\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про спорядниць, має знати і про лісорубів
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(lmbChains >= otfChains - 8,
    `lumberjacks.has: ${lmbChains}, outfitters.has: ${otfChains}`);
});

test('lumberjack ticks with the other machines after the outfitters', () => {
  assert.match(js, /updateOutfitters\(dt\);[\s\S]{0,400}updateLumberjacks\(dt\);/);
});

test('lumberjack fells only a real trunk, never a menu-placed log', () => {
  // ставлена з меню колода — бутафорія: сокира звіряється з edits, а
  // вирощені із саджанців стовбури виправдовує реєстр grownLogs
  assert.match(js, /if \(edits\.get\(k\) === LOG && !grownLogs\.has\(k\)\) continue;/);
  // сяг лісоруба обмежений по горизонталі й вертикалі
  assert.match(js, /const LUMBER_REACH = 2;/);
  assert.match(js, /dy = -LUMBER_DY_DOWN; dy <= LUMBER_DY_UP;/);
  // клітинка тумби й опора під нею недоторканні
  assert.match(js, /if \(dx === 0 && dz === 0 && dy <= 0\) continue;[\s\S]{0,200}!== LOG\) continue;/);
});

test('lumberjack chops top-down: only the top log of the nearest trunk', () => {
  // над колодою нема колоди — жодної висячої; найближчий стовбур перший,
  // у ньому найвища колода
  assert.match(js, /if \(blockAt\(x, y \+ 1, z\) === LOG\) continue;/);
  assert.match(js, /const score = -\(dx \* dx \+ dz \* dz\) \* 100 \+ dy;/);
});

test('timber lands on the fullest not-yet-full shelf beside the lumberjack', () => {
  // серед скринь впритул — найповніша (та ще не повна) полиця колод
  assert.match(js, /function lumberjackChest\(l\) \{\s*\n\s*let best = null, bestN = -1;/);
  assert.match(js, /const n = ch\.store\.timber \| 0;\s*\n\s*if \(n < CHEST_STACK && n > bestN\) \{ bestN = n; best = ch; \}/);
});

test('felling is atomic: the log stays in the trunk until the exchange', () => {
  // колода сходить зі стовбура і лягає на полицю одним обміном у
  // lumberjackFinish; стовбур, що зник по дорозі, не дає нічого
  assert.match(js, /function lumberjackFinish\(l, log\)/);
  assert.match(js, /if \(!chest \|\| blockAt\(log\.x, log\.y, log\.z\) !== LOG\) return;/);
  assert.match(js, /setBlock\(log\.x, log\.y, log\.z, AIR\);/);
  assert.match(js, /chest\.store\.timber = Math\.min\(CHEST_STACK, \(chest\.store\.timber \| 0\) \+ 1\);/);
  assert.match(js, /l\.felled = \(l\.felled \| 0\) \+ 1;/);
});

test('timber is a new chest good and a new bag pocket', () => {
  // 🪵 колоди — повноцінний крам: полиця скрині, кишеня торби, кап,
  // збереження і бейдж HUD
  assert.match(js, /timber:\s*\{ icon: '🪵', name: 'колоди',\s*max: TIMBER_BAG_MAX \},/);
  assert.match(js, /const TIMBER_BAG_MAX = 32;/);
  assert.match(js, /timber: 0,\s*\/\/ колоди/);
  assert.match(js, /timber: player\.timber,/);
  assert.match(js, /player\.timber = THREE\.MathUtils\.clamp\(Math\.floor\(p\.timber\), 0, TIMBER_BAG_MAX\);/);
  assert.match(js, /function updateTimberHud\(\)/);
  assert.match(js, /else if \(kind === 'timber'\) updateTimberHud\(\);/);
  assert.match(html, /id="timber-badge"/);
});

test('hand path stays and now credits the bag with the same timber', () => {
  // колода, як і раніше, рубається вручну — тепер у торбу, і той самий
  // захист від «постав-вибий» діє і для руки
  assert.match(js, /const logFromWorld = id === LOG &&\s*\n\s*\(edits\.get\(key\) !== id \|\| grownLogs\.has\(key\)\);/);
  assert.match(js, /if \(logFromWorld\) collectTimber\(\);/);
  assert.match(js, /function collectTimber\(\)/);
});

test('sapling-grown trunks are real trees: the grownLogs registry', () => {
  // вирощена колода лишає слід у edits, тож реєстр виправдовує її перед
  // рукою і сокирою; зрубана клітинка випадає з реєстру в setBlock
  assert.match(js, /grownLogs\.add\(x \+ ',' \+ \(y \+ dy\) \+ ',' \+ z\);/);
  assert.match(js, /if \(id !== LOG\) grownLogs\.delete\(editKey\);/);
  assert.match(js, /grownLogs: \[\.\.\.grownLogs\],/);
  assert.match(js, /savedGame\.grownLogs/);
});

test('lumberjack achievements are registered', () => {
  assert.match(js, /id: 'autolog'/);
  assert.match(js, /id: 'sawmill'/);
});

test('lumberjack is saved and restored with the world', () => {
  assert.match(js, /lumberjacks: \[\.\.\.lumberjacks\.values\(\)\]/);
  assert.match(js, /savedGame\.lumberjacks/);
});

test('controls help documents the lumberjack (desktop and touch)', () => {
  const entries = html.match(/Лісоруб/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
