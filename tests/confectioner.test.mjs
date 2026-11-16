import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('confectioner is wired into every machine guard chain next to colliers', () => {
  const clrChains = (js.match(/!?colliers\.has\(/g) || []).length;
  const cnfChains = (js.match(/!?confectioners\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про вуглежогів, має знати і про медові печі
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(cnfChains >= clrChains - 8,
    `confectioners.has: ${cnfChains}, colliers.has: ${clrChains}`);
});

test('confectioner ticks with the other machines after the colliers', () => {
  assert.match(js, /updateColliers\(dt\);[\s\S]{0,400}updateConfectioners\(dt\);/);
});

test('confectioner needs a chest with BOTH flour and honey plus cake shelf space', () => {
  // перша машина з двома крамами на вході: скриня береться лише з борошном,
  // медом і місцем на полиці медяників одночасно
  assert.match(js, /\(ch\.store\.flour \|\| 0\) >= 1 && \(ch\.store\.honey \|\| 0\) >= 1 &&\s*\n\s*\(ch\.store\.cake \|\| 0\) < CHEST_STACK/);
  // без скрині чи без сировини — жар жевріє дарма
  assert.match(js, /const chest = confectionerChest\(f\);/);
});

test('confectioner swap is atomic at the moment of baking (nothing to lose)', () => {
  // обмін відбувається всередині confectionerFinish — зламана піч нічого не губить
  assert.match(js, /function confectionerFinish\(f, chest\)/);
  assert.match(js, /chest\.store\.flour -= 1;\s*\n\s*chest\.store\.honey -= 1;\s*\n\s*chest\.store\.cake = \(chest\.store\.cake \|\| 0\) \+ 1;/);
  assert.match(js, /f\.baked = \(f\.baked \| 0\) \+ 1;/);
});

test('cake is a full chest good with its own bag pocket and HUD badge', () => {
  // медяник — крам скрині (комірниця, спорядниця й носій беруть його generic-ом)
  assert.match(js, /cake:\s*\{ icon: '🥮', name: 'медяники',\s*max: CAKE_MAX \}/);
  assert.match(js, /updateChestKindHud\('cake'\);/);
  // кишеня торби зберігається і відновлюється з капом
  assert.match(js, /cake: player\.cake,/);
  assert.match(js, /player\.cake = THREE\.MathUtils\.clamp\(Math\.floor\(p\.cake\), 0, CAKE_MAX\);/);
  // бейдж HUD на місці
  assert.match(js, /function updateCakeHud\(\)/);
  assert.match(html, /id="cake-badge"/);
});

test('cake is the most filling dish: hand eats it first, canteen serves it first', () => {
  // медяник ситніший за хліб і їсться першим
  assert.match(js, /const CAKE_FOOD = 14;/);
  assert.match(js, /const cookedBest = player\.cake > 0 \? CAKE_FOOD\s*\n\s*: player\.bread > 0 \? BREAD_FOOD/);
  assert.match(js, /if \(player\.cake > 0\) \{\s*\n\s*player\.cake -= 1;/);
  // меню трапезниці очолює медяник — тим самим щаблем, що й рука
  assert.match(js, /const CANTEEN_MENU = \[\s*\n\s*\['cake',\s+CAKE_FOOD\],\s*\n\s*\['bread',\s+BREAD_FOOD\],/);
});

test('confectioner waits idle without power or without a chest', () => {
  // без живлення жар гасне, без скрині лічильник роботи не тікає
  assert.match(js, /function confectionerPowered\(f\)/);
  assert.match(js, /if \(!on\) continue;\s*\n\s*const chest = confectionerChest\(f\);\s*\n\s*if \(!chest\) continue;/);
});

test('confectioner achievements are registered', () => {
  assert.match(js, /id: 'autocake'/);
  assert.match(js, /id: 'cakeworks'/);
});

test('confectioner is saved and restored with the world', () => {
  assert.match(js, /confectioners: \[\.\.\.confectioners\.values\(\)\]/);
  assert.match(js, /savedGame\.confectioners/);
});

test('controls help documents the confectioner (desktop and touch)', () => {
  const entries = html.match(/Медова піч/g) || [];
  assert.ok(entries.length >= 2, `«Медова піч» згадок у довідці: ${entries.length}`);
});
