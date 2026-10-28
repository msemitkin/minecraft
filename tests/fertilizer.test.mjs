import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const js = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('fertilizer is wired into every machine guard chain next to weavers', () => {
  const weaverChains = (js.match(/!?weavers\.has\(/g) || []).length;
  const fertChains = (js.match(/!?fertilizers\.has\(/g) || []).length;
  // кожен ланцюжок, що знає про ткаль, має знати і про добривниці
  // (власні секції машин дають кожній кілька додаткових згадок)
  assert.ok(fertChains >= weaverChains - 8,
    `fertilizers.has: ${fertChains}, weavers.has: ${weaverChains}`);
});

test('fertilizer ticks with the other machines after the weavers', () => {
  assert.match(js, /updateWeavers\(dt\);[\s\S]{0,400}updateFertilizers\(dt\);/);
});

test('fertilizer needs an unripe plant in reach and a chest with bones', () => {
  // сяг добривниці обмежений по горизонталі й вертикалі
  assert.match(js, /FERT_REACH_Y/);
  // дозрілий колос недоторканний — його жне жниварка
  assert.match(js, /if \(c && c\.stage < CROP_STAGES - 1\) plant = c;/);
  // дорослий саджанець теж не чіпає
  assert.match(js, /else if \(s && s\.growth < SAPLING_GROW_TIME\) plant = s;/);
  // без грядки чи кісток — сіялка чекає впорожні
  assert.match(js, /const found = fertilizerTarget\(f\);/);
  // кістка береться з найповнішої полиці скрині впритул
  assert.match(js, /const n = ch\.store\.bones \| 0;\s*\n\s*if \(n > bestN\) \{ bestN = n; best = ch; \}\s*\n\s*\}\s*\n\s*return bestN >= 1 \? best : null;/);
});

test('fertilizing is atomic at the moment of finishing (nothing to lose)', () => {
  // кістка сходить з полиці і посів росте всередині fertilizerFinish —
  // зламана добривниця нічого не губить
  assert.match(js, /function fertilizerFinish\(f, plant, chest\)/);
  assert.match(js, /chest\.store\.bones -= 1;/);
  assert.match(js, /f\.fed = \(f\.fed \| 0\) \+ 1;/);
});

test('fertilizer applies the same boost as the hand bone meal', () => {
  // посів: стадія вгору і скидання росту, як у useBonemeal
  assert.match(js, /plant\.stage\+\+;\s*\n\s*plant\.growth = 0;\s*\n\s*applyCropStage\(plant\);/);
  // саджанець: той самий стрибок BONE_SAPLING_BOOST
  assert.match(js, /plant\.growth \+ SAPLING_GROW_TIME \* BONE_SAPLING_BOOST\);/);
  // тісному саджанцю — та сама поступка, що й з руки
  assert.match(js, /plant\.growth = SAPLING_GROW_TIME \* 0\.8;/);
});

test('hand path stays: bone meal is still sprinkled from the bag', () => {
  // борошно з торби, як і раніше, сипле ПКМ — useBonemeal нікуди не дівся
  assert.match(js, /function useBonemeal\(hit\)/);
  assert.match(js, /player\.bones--;/);
});

test('fertilizer achievements are registered', () => {
  assert.match(js, /id: 'autofert'/);
  assert.match(js, /id: 'fertworks'/);
});

test('fertilizer is saved and restored with the world', () => {
  assert.match(js, /fertilizers: \[\.\.\.fertilizers\.values\(\)\]/);
  assert.match(js, /savedGame\.fertilizers/);
});

test('controls help documents the fertilizer (desktop and touch)', () => {
  const entries = html.match(/Добривниця/g) || [];
  assert.ok(entries.length >= 2, `знайдено ${entries.length} згадок`);
});
