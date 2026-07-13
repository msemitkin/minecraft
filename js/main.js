import * as THREE from 'three';

// ============================================================
// Константи світу
// ============================================================
const CHUNK = 16;          // розмір чанка по X/Z
const HEIGHT = 64;         // висота світу
const SEA = 26;            // рівень моря
const RENDER_DIST = 4;     // радіус видимості в чанках
const SEED = 20260610;
const DAY_LENGTH = 240;    // секунд на повний цикл день/ніч

// Типи блоків
const AIR = 0, GRASS = 1, DIRT = 2, STONE = 3, SAND = 4,
      LOG = 5, LEAVES = 6, WATER = 7, PLANK = 8;
// Текуча вода (рівні 3..1) і динаміт
const FLOW3 = 9, FLOW2 = 10, FLOW1 = 11, TNT = 12;
// Руди (генеруються в камені, добуваються та ставляться як декоративні блоки)
const COAL = 13, IRON = 14, GOLD = 15, DIAMOND = 16;
// Смолоскип — особливий «предмет», що не зберігається у воксельній сітці:
// він ставиться окремою сутністю (модель + світло), тож не належить чанку.
const TORCH = 17;
// Насіння — теж особливий «предмет»-сутність: садиться на траву/землю й
// проростає окремою сутністю-посівом (грядка), не змінюючи воксельну сітку.
const SEEDS = 18;
// Лук — особливий «предмет»: ним не ставлять блок, а натягують (утримуючи ЛКМ)
// і пускають стрілу-снаряд, що летить із гравітацією та б'є істот на відстані.
const BOW = 19;
// Ліжко — особливий «предмет»-сутність (як смолоскип): ставиться на тверду
// опору, не належить воксельній сітці. Подивившись на нього (ПКМ) уночі,
// можна проспати ніч до світанку й закріпити точку відродження.
const BED = 20;
// Біомні блоки: сніг (поверхня снігової тундри) і кактус (стовпами в пустелі).
// Звичайні воксельні блоки — генеруються рельєфом, добуваються та ставляться.
const SNOW = 21, CACTUS = 22;
// Гравій — сипкий блок: генерується кишенями в камені й, як і пісок, підкоряється
// гравітації (падає окремою сутністю, коли під ним зникає опора).
const GRAVEL = 23;
// Лава — гарячий флюїд (як вода, але світиться, тече повільніше й недалеко, палить
// усе живе). Джерело + три рівні потоку. Генерується озерами в надрах печер, а
// зустрівшись із водою — застигає в камінь.
const LAVA = 24, LFLOW3 = 25, LFLOW2 = 26, LFLOW1 = 27;

// Вудка — окремий предмет (як лук): закидається у воду, ловить рибу в торбу їжі
const ROD = 28;
// Відро — окремий предмет-стан: порожнім набирає джерело води чи лави з світу,
// а повним виливає це джерело деінде (запускаючи симуляцію потоку). Стан
// (порожнє / з водою / з лавою) кодується окремим id, що займає слот хотбара —
// так само, як інші предмети. У воксельну сітку відро ніколи не потрапляє.
const BUCKET = 29, WATER_BUCKET = 30, LAVA_BUCKET = 31;
const isBucket = (id) => id === BUCKET || id === WATER_BUCKET || id === LAVA_BUCKET;

// Човен — окремий предмет (як лук/вудка/відро): ставиться ПКМ на воду чи землю
// й спливає окремою сутністю-моделлю. Гравець сідає в нього (ПКМ по човну) і
// пливе поверхнею води швидше, ніж уплав; Space злазить. У воксельну сітку
// човен ніколи не потрапляє.
const BOAT = 32;

// Драбина — окремий предмет-сутність (як смолоскип): чіпляється ПКМ на бічну
// грань твердого блока й дає лазити вертикально (W/Space — угору, Shift — униз,
// без клавіш — повільне сповзання). У воксельну сітку не потрапляє.
const LADDER = 33;

// Скло — прозорий будівельний блок: звичайний воксель (тверда фізика, як
// камінь), але рендериться окремим напівпрозорим мешем, тож крізь нього видно
// світ. Грані між сусідніми стеклами не малюються — суцільні вітражі без швів.
const GLASS = 34;

// Двері — окремий предмет: сутність на дві клітинки заввишки (як драбина, не
// воксель). Зачинені — тверда перешкода для гравця й нечисті, ПКМ відчиняє
const DOOR = 35;

// Вовна — м'який будівельний блок (звичайний воксель): настрижена з овець,
// доступна в меню (Tab). Кучерява процедурна текстура, приглушений звук кроків
const WOOL = 36;

// Паркан і хвіртка — окремі предмети-сутності (як двері, не вокселі): огорожа
// заввишки «півтора блока» для колізій (блокує і клітинку над собою), тож її
// не перестрибнути — загони для тварин і безпечні двори. Хвіртка відчиняється ПКМ
const FENCE = 37, GATE = 38;

// Саджанець — окремий предмет-сутність (як насіння, не воксель): садиться ПКМ
// на траву/землю, росте від світла і виростає у справжнє воксельне дерево
// (стовбур з колод + крона з листя) — відновлюваний ліс.
const SAPLING = 39;

const BLOCK_NAMES = {
  [GRASS]: 'Трава', [DIRT]: 'Земля', [STONE]: 'Камінь', [SAND]: 'Пісок',
  [LOG]: 'Колода', [LEAVES]: 'Листя', [PLANK]: 'Дошки', [WATER]: 'Вода',
  [TNT]: 'Динаміт',
  [COAL]: 'Вугільна руда', [IRON]: 'Залізна руда',
  [GOLD]: 'Золота руда', [DIAMOND]: 'Алмазна руда',
  [TORCH]: 'Смолоскип', [SEEDS]: 'Насіння', [BOW]: 'Лук', [BED]: 'Ліжко',
  [SNOW]: 'Сніг', [CACTUS]: 'Кактус', [GRAVEL]: 'Гравій', [LAVA]: 'Лава',
  [ROD]: 'Вудка',
  [BUCKET]: 'Відро', [WATER_BUCKET]: 'Відро з водою', [LAVA_BUCKET]: 'Відро з лавою',
  [BOAT]: 'Човен', [LADDER]: 'Драбина', [GLASS]: 'Скло', [DOOR]: 'Двері',
  [WOOL]: 'Вовна', [FENCE]: 'Паркан', [GATE]: 'Хвіртка',
  [SAPLING]: 'Саджанець',
};

// Усі блоки, доступні для встановлення — показуються в меню вибору (Tab)
const ALL_BLOCKS = [
  GRASS, DIRT, STONE, SAND, GRAVEL, SNOW, LOG, LEAVES, PLANK, GLASS, WOOL,
  WATER, LAVA,
  TNT, COAL, IRON, GOLD, DIAMOND, CACTUS, TORCH, SEEDS, SAPLING, BOW, ROD, BED,
  BUCKET, BOAT, LADDER, DOOR, FENCE, GATE,
];

// Сипкі блоки: підкоряються гравітації — падають окремою сутністю, коли під
// ними немає твердої опори (порожнеча або вода). Падіння запускає лише оновлення
// блоків (видобуток/встановлення/вибух), тож згенерований рельєф лишається на місці.
const isFalling = (id) => id === SAND || id === GRAVEL;

// Хотбар: 10 слотів швидкого доступу (клавіші 1–9 та 0).
// Блоки, які не вмістилися, доступні через меню (Tab) і призначаються в слот.
const HOTBAR_SIZE = 10;
const DEFAULT_HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANK, WATER, TNT, TORCH];

const isWaterId = (id) => id === WATER || (id >= FLOW3 && id <= FLOW1);
// Лава — окремий флюїд: джерело LAVA + потоки LFLOW3..1
const isLavaId = (id) => id === LAVA || (id >= LFLOW3 && id <= LFLOW1);
const isFluid = (id) => isWaterId(id) || isLavaId(id);
const isSolid = (id) => id !== AIR && !isFluid(id);
// Рівень води: джерело = 4, потоки = 3..1
const WATER_LEVEL = { [WATER]: 4, [FLOW3]: 3, [FLOW2]: 2, [FLOW1]: 1 };
const FLOW_OF_LEVEL = { 3: FLOW3, 2: FLOW2, 1: FLOW1 };
// Рівень лави дзеркалить воду (джерело=4 над стелею потоку=3), щоб вертикальні
// струмені були стабільні й не «мигали» між рівнями. Коротшу дальність
// розтікання дає жорсткіший поріг у tickLavaCell (lvl > 2), а не менші числа.
const LAVA_LEVEL = { [LAVA]: 4, [LFLOW3]: 3, [LFLOW2]: 2, [LFLOW1]: 1 };
const LFLOW_OF_LEVEL = { 3: LFLOW3, 2: LFLOW2, 1: LFLOW1 };
const LAVA_SEA_Y = 8;   // до цієї висоти лава заливає дно печер у надрах

// Скільки секунд утримувати ЛКМ, щоб видобути блок
const BLOCK_HARDNESS = {
  [GRASS]: 0.5, [DIRT]: 0.5, [SAND]: 0.55,
  [LEAVES]: 0.3, [LOG]: 1.0, [PLANK]: 0.9, [STONE]: 1.6,
  [COAL]: 2.2, [IRON]: 2.8, [GOLD]: 2.8, [DIAMOND]: 3.6,
  [SNOW]: 0.4, [CACTUS]: 0.5, [GRAVEL]: 0.7, [GLASS]: 0.35, [WOOL]: 0.45,
};
const DEFAULT_HARDNESS = 0.6;

// ============================================================
// Шум та генерація рельєфу
// ============================================================
function ihash(x, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(z, 668265263) ^ Math.imul(SEED, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

const smooth = (t) => t * t * (3 - 2 * t);

function valueNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  const a = ihash(xi, zi), b = ihash(xi + 1, zi);
  const c = ihash(xi, zi + 1), d = ihash(xi + 1, zi + 1);
  const u = smooth(xf), v = smooth(zf);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

function fbm(x, z) {
  let sum = 0, amp = 1, freq = 1, norm = 0;
  for (let i = 0; i < 4; i++) {
    sum += valueNoise(x * freq, z * freq) * amp;
    norm += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return sum / norm;
}

function heightAt(x, z) {
  const base = fbm(x / 60, z / 60);
  const mountains = fbm(x / 180 + 100, z / 180 + 100);
  // Низини нижче рівня моря дають озера (~10% площі)
  const h = 12 + base * 24 + mountains * mountains * 28;
  return Math.max(2, Math.min(HEIGHT - 10, Math.floor(h)));
}

// ===== Біоми: великі регіони з власною поверхнею та рослинністю =====
// Біом задає низькочастотний шум (регіони ~150–200 блоків), тож сусідні колони
// майже завжди в одному біомі — переходи плавні, без «шахівниці».
const BIOME = { PLAINS: 0, FOREST: 1, DESERT: 2, SNOWY: 3 };
const BIOME_NAMES = { 0: 'Рівнина', 1: 'Ліс', 2: 'Пустеля', 3: 'Снігова тундра' };

// Окремий згладжений шум для біомів: лише 2 октави й велика база, тож регіони
// виходять великими та плавними (4-октавний fbm рельєфу подрібнив би їх у
// «шахівницю»).
function biomeNoise(x, z, ox, oz, scale) {
  return valueNoise(x / scale + ox, z / scale + oz) * 0.68 +
         valueNoise(x / (scale * 0.5) + ox + 50, z / (scale * 0.5) + oz + 50) * 0.32;
}

function biomeAt(x, z) {
  // «Температура» розводить теплі (пустеля) й холодні (тундра) краї карти.
  const temp = biomeNoise(x, z, 555.5, -311.5, 200);
  if (temp < 0.42) return BIOME.SNOWY;
  if (temp > 0.60) return BIOME.DESERT;
  // Помірний пояс: окремий шум «вологості» ділить його на ліс і рівнину.
  const wet = biomeNoise(x, z, -88.5, 200.5, 170);
  return wet > 0.52 ? BIOME.FOREST : BIOME.PLAINS;
}

// Імовірність дерева в колоні залежить від біому: густий ліс, рідка рівнина,
// поодинокі засніжені ялинки в тундрі, жодного дерева в пустелі.
const TREE_DENSITY = { 0: 0.018, 1: 0.06, 2: 0, 3: 0.012 };
const treeAt = (x, z) => ihash(x + 39163, z - 21577) < TREE_DENSITY[biomeAt(x, z)];

// Кактус: поодинокі стовпи 1–3 блоки лише на сухій поверхні пустелі.
const cactusAt = (x, z) => biomeAt(x, z) === BIOME.DESERT &&
  ihash(x + 14771, z - 50261) < 0.020;

// ===== Печери: 3D-шум вирізає тунелі =====
function ihash3(x, y, z) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 1597334677) ^ Math.imul(z, 668265263) ^ Math.imul(SEED, 1013904223);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function valueNoise3(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const u = smooth(x - xi), v = smooth(y - yi), w = smooth(z - zi);
  const n000 = ihash3(xi, yi, zi), n100 = ihash3(xi + 1, yi, zi);
  const n010 = ihash3(xi, yi + 1, zi), n110 = ihash3(xi + 1, yi + 1, zi);
  const n001 = ihash3(xi, yi, zi + 1), n101 = ihash3(xi + 1, yi, zi + 1);
  const n011 = ihash3(xi, yi + 1, zi + 1), n111 = ihash3(xi + 1, yi + 1, zi + 1);
  const x00 = n000 + (n100 - n000) * u, x10 = n010 + (n110 - n010) * u;
  const x01 = n001 + (n101 - n001) * u, x11 = n011 + (n111 - n011) * u;
  const y0 = x00 + (x10 - x00) * v, y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

// ===== Руди: жили з 3D-шуму в камені =====
// Жила там, де шум потрапляє у вузьку смугу навколо 0.5; зсув і ширина
// смуги задають окрему «сітку» жил для кожної руди.
function oreVein(x, y, z, off, th) {
  const n = valueNoise3((x + off) / 5, (y + off) / 5, (z + off) / 5);
  return Math.abs(n - 0.5) < th;
}

// Тип руди для блока каменю: рідкісніші руди — глибше.
// Перевіряємо від найглибшої/найрідкіснішої до звичайної.
// (частки каменю: вугілля ~4.6%, залізо ~2.3%, золото ~0.6%, алмаз ~0.17%)
function oreAt(x, y, z) {
  if (y <= 14 && oreVein(x, y, z, 701, 0.0018)) return DIAMOND;
  if (y <= 24 && oreVein(x, y, z, 503, 0.0035)) return GOLD;
  if (y <= 42 && oreVein(x, y, z, 307, 0.0075)) return IRON;
  if (y <= 54 && oreVein(x, y, z, 109, 0.012)) return COAL;
  // Гравій: широкі кишені в камені на будь-якій глибині (~6% каменю).
  if (oreVein(x, y, z, 211, 0.03)) return GRAVEL;
  return STONE;
}

// Тунель там, де дві незалежні шумові «стрічки» перетинаються.
// Поріг згасає біля поверхні, щоб входи в печери були рідкісними.
function caveAt(x, y, z, h) {
  if (y < 2) return false;
  const fade = Math.min(1, (h - y) / 10 + 0.2);
  const th = 0.085 * fade;
  const a = valueNoise3(x / 26, y / 18, z / 26);
  if (Math.abs(a - 0.5) >= th) return false;
  const b = valueNoise3(x / 26 + 77, y / 18 + 77, z / 26 + 77);
  return Math.abs(b - 0.5) < th;
}

// ============================================================
// Дані чанків
// ============================================================
const chunkData = new Map();   // "cx,cz" -> Uint8Array
const chunkMeshes = new Map(); // "cx,cz" -> { solid, water }
const edits = new Map();       // "x,y,z" -> id (зміни гравця)
const dirtyChunks = new Set();

const chunkKey = (cx, cz) => cx + ',' + cz;
const blockIndex = (lx, ly, lz) => (ly * CHUNK + lz) * CHUNK + lx;

// ============================================================
// Збереження світу в localStorage
// ============================================================
// v4: версія генератора (біоми: пустеля/тундра/ліс + сніг і кактуси) —
// старі сейви несумісні, бо поверхня тих самих координат тепер інша
const SAVE_KEY = `mineclone:${SEED}:v4`;

function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

let saveEnabled = true;

function saveGame() {
  if (!saveEnabled) return;
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      edits: [...edits],
      player: {
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch,
        health: player.health,
        hunger: player.hunger,
        food: player.food,
        flying: player.flying,
      },
      timeOfDay,
      weather: { state: weatherState, timer: weatherTimer, intensity: weatherIntensity },
      torches: [...torches.values()].map((t) => [t.x, t.y, t.z, t.face, t.dx, t.dz]),
      crops: [...crops.values()].map((c) => [c.x, c.y, c.z, c.stage, +c.growth.toFixed(2)]),
      saplings: [...saplings.values()].map((s) => [s.x, s.y, s.z, +s.growth.toFixed(2)]),
      beds: [...beds.values()].map((b) => [b.x, b.y, b.z, b.yaw]),
      ladders: [...ladders.values()].map((l) => [l.x, l.y, l.z, l.dx, l.dz]),
      doors: [...doors.values()].map((d) => [d.x, d.y, d.z, d.dx, d.dz, d.open ? 1 : 0]),
      fences: [...fences.values()].map((f) => [f.x, f.y, f.z]),
      gates: [...gates.values()].map((g) => [g.x, g.y, g.z, g.dx, g.dz, g.open ? 1 : 0]),
      boats: boats.map((b) => [+b.pos.x.toFixed(2), +b.pos.y.toFixed(2), +b.pos.z.toFixed(2), +b.yaw.toFixed(3)]),
      wolves: animals.filter((a) => a.type === 'wolf' && a.tamed)
        .map((a) => [+a.pos.x.toFixed(1), +a.pos.y.toFixed(1), +a.pos.z.toFixed(1),
                     +a.health.toFixed(1), a.sitting ? 1 : 0]),
      horses: animals.filter((a) => a.type === 'horse' && a.tamed)
        .map((a) => [+a.pos.x.toFixed(1), +a.pos.y.toFixed(1), +a.pos.z.toFixed(1),
                     +a.health.toFixed(1)]),
      spawn: spawnPoint,
      selectedSlot,
      hotbar: [...hotbar],
      soundOn: Sound.isEnabled(),
    }));
  } catch {
    // сховище переповнене або недоступне — просто пропускаємо
  }
}

function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}

const savedGame = loadGame();
if (savedGame && Array.isArray(savedGame.edits)) {
  for (const [key, id] of savedGame.edits) edits.set(key, id);
}

// ============================================================
// Звук: процедурні ефекти через Web Audio API (без зовнішніх файлів)
// ============================================================
// Усі звуки синтезуються на льоту (осцилятори + білий шум + фільтри),
// тож не потрібно жодних аудіофайлів. Контекст створюється лише після
// дії користувача (вимога браузерів до автозапуску звуку).
const Sound = (() => {
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  // Початковий стан вимикача звуку береться зі збереження (типово — увімкнено)
  let enabled = !(savedGame && savedGame.soundOn === false);
  const MASTER_VOL = 0.5;

  function ensureCtx() {
    if (ctx) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = enabled ? MASTER_VOL : 0;
    master.connect(ctx.destination);
    // Секунда білого шуму — основа для ударів, кроків і вибухів
    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuffer.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  // Викликається з обробників жестів користувача, щоб «розбудити» аудіо
  function resume() {
    ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume();
  }

  function envGain(dur, gain, attack = 0.004) {
    const t = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  // Короткий сплеск відфільтрованого шуму
  function noise({ dur = 0.12, gain = 0.3, type = 'bandpass', freq = 800, q = 1, attack = 0.004 }) {
    if (!ctx || !enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const filt = ctx.createBiquadFilter();
    filt.type = type;
    filt.frequency.value = freq;
    filt.Q.value = q;
    const g = envGain(dur, gain, attack);
    src.connect(filt).connect(g).connect(master);
    src.start();
    src.stop(ctx.currentTime + dur + 0.03);
    return { filt };
  }

  // Тон осцилятора з опційним ковзанням частоти
  function tone({ freq = 440, dur = 0.15, type = 'sine', gain = 0.2, slideTo = null, attack = 0.005 }) {
    if (!ctx || !enabled) return;
    const osc = ctx.createOscillator();
    osc.type = type;
    const t = ctx.currentTime;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    const g = envGain(dur, gain, attack);
    osc.connect(g).connect(master);
    osc.start();
    osc.stop(t + dur + 0.03);
    return { osc };
  }

  // Звукова «матеріальність» блока: частота/фільтр залежать від типу
  function material(id) {
    if (id === SAND) return { freq: 360, q: 0.8, type: 'lowpass' };
    if (id === LOG || id === PLANK) return { freq: 520, q: 2.4, type: 'bandpass' };
    if (id === LEAVES) return { freq: 1700, q: 0.7, type: 'highpass' };
    if (id === GLASS) return { freq: 2600, q: 1.4, type: 'highpass' };   // дзвінкий кришталь
    if (id === WOOL) return { freq: 280, q: 0.6, type: 'lowpass' };      // м'який приглушений
    if (id === GRASS || id === DIRT) return { freq: 620, q: 0.9, type: 'bandpass' };
    // камінь, руди, динаміт — твердий «цок»
    return { freq: 1100, q: 1.6, type: 'bandpass' };
  }

  // Безперервний дощ: зациклений відфільтрований шум, гучність керує погода
  let rainSrc = null, rainGain = null;
  function ensureRain() {
    ensureCtx();
    if (!ctx || rainSrc) return;
    rainSrc = ctx.createBufferSource();
    rainSrc.buffer = noiseBuffer;
    rainSrc.loop = true;
    const filt = ctx.createBiquadFilter();
    filt.type = 'bandpass';
    filt.frequency.value = 1500;
    filt.Q.value = 0.4;
    rainGain = ctx.createGain();
    rainGain.gain.value = 0.0001;
    rainSrc.connect(filt).connect(rainGain).connect(master);
    rainSrc.start();
  }

  return {
    resume,
    isEnabled: () => enabled,
    setEnabled(on) {
      enabled = on;
      if (master) master.gain.setTargetAtTime(on ? MASTER_VOL : 0, ctx.currentTime, 0.015);
    },
    toggle() { this.setEnabled(!enabled); return enabled; },

    step(id) {
      const m = material(id);
      noise({ dur: 0.085, gain: 0.12, type: m.type, freq: m.freq * 0.7, q: m.q, attack: 0.002 });
    },
    dig(id) {
      const m = material(id);
      noise({ dur: 0.1, gain: 0.16, type: m.type, freq: m.freq, q: m.q + 0.6 });
    },
    breakBlock(id) {
      const m = material(id);
      noise({ dur: 0.22, gain: 0.26, type: m.type, freq: m.freq, q: m.q });
      tone({ freq: 150, dur: 0.16, type: 'sine', gain: 0.12, slideTo: 70 });
    },
    place(id) {
      const m = material(id);
      noise({ dur: 0.09, gain: 0.18, type: m.type, freq: m.freq * 0.9, q: m.q });
      tone({ freq: 220, dur: 0.1, type: 'sine', gain: 0.1, slideTo: 130 });
    },
    door(open) {
      // Рип завіс: скрип смуги шуму + тон, що ковзає вгору (відчинити) чи
      // вниз із дерев'яним стуком (зачинити)
      noise({ dur: 0.14, gain: 0.09, type: 'bandpass', freq: 480, q: 3 });
      if (open) {
        tone({ freq: 150, dur: 0.22, type: 'square', gain: 0.045, slideTo: 250 });
      } else {
        tone({ freq: 230, dur: 0.18, type: 'square', gain: 0.045, slideTo: 120 });
        noise({ dur: 0.1, gain: 0.15, type: 'lowpass', freq: 420, q: 0.8 });
      }
    },
    jump() { tone({ freq: 260, dur: 0.16, type: 'sine', gain: 0.1, slideTo: 440 }); },
    land() { noise({ dur: 0.14, gain: 0.18, type: 'lowpass', freq: 300, q: 0.7 }); },
    splash() {
      noise({ dur: 0.3, gain: 0.2, type: 'highpass', freq: 900, q: 0.5 });
      noise({ dur: 0.18, gain: 0.12, type: 'bandpass', freq: 500, q: 0.8 });
    },
    hurt() {
      tone({ freq: 300, dur: 0.22, type: 'sawtooth', gain: 0.16, slideTo: 110 });
      noise({ dur: 0.12, gain: 0.1, type: 'bandpass', freq: 700, q: 0.8 });
    },
    explosion() {
      noise({ dur: 0.9, gain: 0.5, type: 'lowpass', freq: 420, q: 0.6, attack: 0.005 });
      tone({ freq: 90, dur: 0.7, type: 'sine', gain: 0.35, slideTo: 28 });
      tone({ freq: 150, dur: 0.4, type: 'triangle', gain: 0.18, slideTo: 50 });
    },
    fuse() { tone({ freq: 1400, dur: 0.06, type: 'square', gain: 0.05 }); },
    // Смолоскип: м'яке потріскування полум'я (короткий відфільтрований шум)
    torch(gain = 0.12) {
      noise({ dur: 0.12, gain, type: 'highpass', freq: 1900, q: 0.6, attack: 0.002 });
      noise({ dur: 0.07, gain: gain * 0.7, type: 'bandpass', freq: 900, q: 0.8 });
    },
    // Лава: глухе булькотливе гудіння (фон поблизу озера)
    lava(gain = 0.05) {
      noise({ dur: 0.55, gain, type: 'lowpass', freq: 190, q: 0.6, attack: 0.06 });
      tone({ freq: 60, dur: 0.5, type: 'sine', gain: gain * 0.6, slideTo: 44 });
    },
    // Сичання пари, коли лава застигає у воді
    lavaHiss() {
      noise({ dur: 0.4, gain: 0.18, type: 'highpass', freq: 2400, q: 0.5, attack: 0.004 });
      noise({ dur: 0.24, gain: 0.1, type: 'bandpass', freq: 780, q: 0.7 });
    },
    // Стрижка вівці: два швидкі «вжик»-клацання ножиць
    shear() {
      noise({ dur: 0.09, gain: 0.16, type: 'highpass', freq: 3200, q: 0.7 });
      tone({ freq: 1150, dur: 0.07, type: 'square', gain: 0.05, slideTo: 700 });
      setTimeout(() => {
        if (!enabled) return;
        noise({ dur: 0.09, gain: 0.14, type: 'highpass', freq: 3400, q: 0.7 });
        tone({ freq: 1050, dur: 0.07, type: 'square', gain: 0.05, slideTo: 650 });
      }, 110);
    },
    // Вовк: короткий дзвінкий «гав» (два стрибки тону вниз)
    bark() {
      tone({ freq: 360, dur: 0.09, type: 'square', gain: 0.11, slideTo: 190 });
      noise({ dur: 0.07, gain: 0.06, type: 'bandpass', freq: 900, q: 1.2 });
      setTimeout(() => {
        if (!enabled) return;
        tone({ freq: 320, dur: 0.11, type: 'square', gain: 0.11, slideTo: 160 });
      }, 110);
    },
    // Кінь: коротке іржання — два низхідні тремтливі тони
    neigh() {
      tone({ freq: 920, dur: 0.14, type: 'sawtooth', gain: 0.07, slideTo: 640 });
      setTimeout(() => {
        if (!enabled) return;
        tone({ freq: 700, dur: 0.26, type: 'sawtooth', gain: 0.06, slideTo: 320, attack: 0.03 });
      }, 120);
    },
    // Вовче скавуління-подяка при годуванні: висхідний м'який тон
    whine() {
      tone({ freq: 480, dur: 0.3, type: 'triangle', gain: 0.08, slideTo: 780, attack: 0.05 });
    },
    mobHit() {
      noise({ dur: 0.14, gain: 0.2, type: 'bandpass', freq: 450, q: 1.2 });
      tone({ freq: 160, dur: 0.12, type: 'square', gain: 0.08, slideTo: 90 });
    },
    mobGroan() {
      tone({ freq: 120, dur: 0.5, type: 'sawtooth', gain: 0.13, slideTo: 80, attack: 0.06 });
      tone({ freq: 61, dur: 0.5, type: 'square', gain: 0.05, attack: 0.06 });
    },
    mobDeath() {
      tone({ freq: 200, dur: 0.6, type: 'sawtooth', gain: 0.16, slideTo: 55, attack: 0.01 });
      noise({ dur: 0.3, gain: 0.12, type: 'lowpass', freq: 600, q: 0.7 });
    },
    // Кріпер запалює ґніт: довге сичання — наростаючий відфільтрований шум
    creeperHiss() {
      noise({ dur: 1.1, gain: 0.28, type: 'highpass', freq: 2600, q: 0.5, attack: 0.25 });
      noise({ dur: 1.1, gain: 0.14, type: 'bandpass', freq: 1400, q: 0.7, attack: 0.25 });
    },
    // Лук натягують: тиха висхідна «рипа» дерева й тятиви
    bowDraw() {
      tone({ freq: 320, dur: 0.45, type: 'triangle', gain: 0.07, slideTo: 520, attack: 0.05 });
      noise({ dur: 0.2, gain: 0.04, type: 'bandpass', freq: 1600, q: 0.6, attack: 0.05 });
    },
    // Постріл: різкий клац тятиви + свист стріли (сила задає гучність)
    bowShoot(power = 1) {
      tone({ freq: 700, dur: 0.1, type: 'square', gain: 0.06 + power * 0.06, slideTo: 240 });
      noise({ dur: 0.18, gain: 0.05 + power * 0.08, type: 'highpass', freq: 2200, q: 0.5 });
    },
    // Стріла встромляється у блок: глухий «тук»
    arrowHit() {
      noise({ dur: 0.1, gain: 0.16, type: 'bandpass', freq: 380, q: 1.4 });
      tone({ freq: 140, dur: 0.1, type: 'sine', gain: 0.08, slideTo: 80 });
    },
    // Закид вудки: короткий свист волосіні + плюскіт поплавка об воду
    cast() {
      tone({ freq: 900, dur: 0.16, type: 'triangle', gain: 0.05, slideTo: 380 });
      setTimeout(() => {
        if (!enabled) return;
        noise({ dur: 0.18, gain: 0.12, type: 'highpass', freq: 1000, q: 0.5 });
      }, 120);
    },
    // Клювання: тихий «бульк» під водою — сигнал підсікати
    bite() {
      tone({ freq: 260, dur: 0.14, type: 'sine', gain: 0.12, slideTo: 150 });
      noise({ dur: 0.1, gain: 0.06, type: 'bandpass', freq: 600, q: 1.2 });
    },
    // Витягли рибу: короткий висхідний «дзинь» удачі
    reelCatch() {
      tone({ freq: 520, dur: 0.1, type: 'triangle', gain: 0.1, slideTo: 660 });
      setTimeout(() => {
        if (!enabled) return;
        tone({ freq: 784, dur: 0.14, type: 'triangle', gain: 0.1, attack: 0.004 });
      }, 90);
    },
    eat() {
      // Два приглушені «хрусти» поспіль — звук жування
      noise({ dur: 0.09, gain: 0.16, type: 'lowpass', freq: 500, q: 0.8 });
      tone({ freq: 180, dur: 0.1, type: 'triangle', gain: 0.08, slideTo: 120 });
      setTimeout(() => {
        if (!enabled) return;
        noise({ dur: 0.08, gain: 0.13, type: 'lowpass', freq: 560, q: 0.8 });
      }, 130);
    },
    // Здобуте досягнення: коротка висхідна мажорна фанфара (C-E-G-C)
    achievement() {
      if (!ctx || !enabled) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => setTimeout(() => {
        if (!enabled) return;
        tone({ freq: f, dur: 0.18, type: 'triangle', gain: 0.12, attack: 0.004 });
      }, i * 95));
    },
    // Рівень дощу 0..1 — плавно піднімає/опускає гучність зацикленого шуму
    setRain(level) {
      if (!ctx && level <= 0) return;
      ensureRain();
      if (rainGain && ctx) {
        rainGain.gain.setTargetAtTime(Math.max(0.0001, level * 0.2), ctx.currentTime, 0.4);
      }
    },
    // Грім: глибокий гуркіт із низьких тонів і шуму
    thunder() {
      if (!ctx || !enabled) return;
      noise({ dur: 1.6, gain: 0.4, type: 'lowpass', freq: 280, q: 0.5, attack: 0.03 });
      tone({ freq: 72, dur: 1.4, type: 'sine', gain: 0.3, slideTo: 30, attack: 0.04 });
      tone({ freq: 120, dur: 0.9, type: 'triangle', gain: 0.14, slideTo: 45, attack: 0.06 });
    },
  };
})();

function genChunkData(cx, cz) {
  const data = new Uint8Array(CHUNK * HEIGHT * CHUNK);
  const wx0 = cx * CHUNK, wz0 = cz * CHUNK;

  // Рельєф
  for (let lx = 0; lx < CHUNK; lx++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      const wx = wx0 + lx, wz = wz0 + lz;
      const h = heightAt(wx, wz);
      const beach = h <= SEA + 1;           // пляжі та дно озер — завжди пісок
      const biome = beach ? -1 : biomeAt(wx, wz);
      const noCaves = beach;                // не дірявити дно озер і пляжі
      // Поверхневий і підповерхневий блок задає біом.
      let surf = GRASS, sub = DIRT;
      if (beach) { surf = SAND; sub = DIRT; }
      else if (biome === BIOME.DESERT) { surf = SAND; sub = SAND; }
      else if (biome === BIOME.SNOWY) { surf = SNOW; sub = DIRT; }
      for (let y = 0; y <= h; y++) {
        if (!noCaves && caveAt(wx, y, wz, h)) {
          // Дно печер у надрах заливає статична лава (до LAVA_SEA_Y)
          if (y > 0 && y <= LAVA_SEA_Y) data[blockIndex(lx, y, lz)] = LAVA;
          continue;
        }
        let id;
        if (y === h) id = surf;
        else if (y > h - 4) id = sub;
        else id = oreAt(wx, y, wz);
        data[blockIndex(lx, y, lz)] = id;
      }
      for (let y = h + 1; y <= SEA; y++) {
        data[blockIndex(lx, y, lz)] = WATER;
      }
    }
  }

  // Дерева (з запасом по краях, щоб крони сусідніх дерев потрапляли в чанк)
  const setInChunk = (wx, wy, wz, id, onlyAir) => {
    const lx = wx - wx0, lz = wz - wz0;
    if (lx < 0 || lx >= CHUNK || lz < 0 || lz >= CHUNK || wy < 0 || wy >= HEIGHT) return;
    const i = blockIndex(lx, wy, lz);
    if (onlyAir && data[i] !== AIR) return;
    data[i] = id;
  };

  for (let tx = wx0 - 2; tx < wx0 + CHUNK + 2; tx++) {
    for (let tz = wz0 - 2; tz < wz0 + CHUNK + 2; tz++) {
      const h = heightAt(tx, tz);
      if (h <= SEA + 1 || !treeAt(tx, tz)) continue;
      if (caveAt(tx, h, tz, h)) continue; // не садити дерево над входом у печеру
      const trunkH = 4 + Math.floor(ihash(tx + 777, tz + 333) * 2);
      // Крона
      for (let dy = trunkH - 1; dy <= trunkH + 2; dy++) {
        const r = dy <= trunkH ? 2 : 1;
        for (let ox = -r; ox <= r; ox++) {
          for (let oz = -r; oz <= r; oz++) {
            if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
            setInChunk(tx + ox, h + dy, tz + oz, LEAVES, true);
          }
        }
      }
      // Стовбур
      for (let dy = 1; dy <= trunkH; dy++) {
        setInChunk(tx, h + dy, tz, LOG, false);
      }
    }
  }

  // Кактуси: стовпи 1–3 блоки на сухій поверхні пустелі (запас на краях — нема
  // крони, але тримаємо ту саму схему обходу, що й дерева).
  for (let tx = wx0; tx < wx0 + CHUNK; tx++) {
    for (let tz = wz0; tz < wz0 + CHUNK; tz++) {
      const h = heightAt(tx, tz);
      if (h <= SEA + 1 || !cactusAt(tx, tz)) continue;
      if (caveAt(tx, h, tz, h)) continue; // не ставити над входом у печеру
      const ch = 1 + Math.floor(ihash(tx + 5, tz + 5) * 3); // 1..3
      for (let dy = 1; dy <= ch; dy++) setInChunk(tx, h + dy, tz, CACTUS, true);
    }
  }

  // Зміни гравця
  for (const [key, id] of edits) {
    const [x, y, z] = key.split(',').map(Number);
    if (Math.floor(x / CHUNK) === cx && Math.floor(z / CHUNK) === cz) {
      data[blockIndex(x - wx0, y, z - wz0)] = id;
    }
  }

  return data;
}

function getChunkData(cx, cz) {
  const key = chunkKey(cx, cz);
  let data = chunkData.get(key);
  if (!data) {
    data = genChunkData(cx, cz);
    chunkData.set(key, data);
  }
  return data;
}

function blockAt(wx, wy, wz) {
  if (wy < 0) return STONE;
  if (wy >= HEIGHT) return AIR;
  const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
  return getChunkData(cx, cz)[blockIndex(wx - cx * CHUNK, wy, wz - cz * CHUNK)];
}

function setBlock(wx, wy, wz, id) {
  if (wy < 0 || wy >= HEIGHT) return;
  const cx = Math.floor(wx / CHUNK), cz = Math.floor(wz / CHUNK);
  const lx = wx - cx * CHUNK, lz = wz - cz * CHUNK;
  getChunkData(cx, cz)[blockIndex(lx, wy, lz)] = id;
  edits.set(wx + ',' + wy + ',' + wz, id);
  dirtyChunks.add(chunkKey(cx, cz));
  if (lx === 0) dirtyChunks.add(chunkKey(cx - 1, cz));
  if (lx === CHUNK - 1) dirtyChunks.add(chunkKey(cx + 1, cz));
  if (lz === 0) dirtyChunks.add(chunkKey(cx, cz - 1));
  if (lz === CHUNK - 1) dirtyChunks.add(chunkKey(cx, cz + 1));
  scheduleWaterAround(wx, wy, wz);
  scheduleLavaAround(wx, wy, wz);
  scheduleGravityAround(wx, wy, wz);
}

// ============================================================
// Симуляція води: тече вниз, обмежено розтікається вбік
// ============================================================
const waterQueue = new Set();

function scheduleWater(x, y, z) {
  if (y >= 0 && y < HEIGHT) waterQueue.add(x + ',' + y + ',' + z);
}

function scheduleWaterAround(x, y, z) {
  scheduleWater(x, y, z);
  scheduleWater(x + 1, y, z);
  scheduleWater(x - 1, y, z);
  scheduleWater(x, y + 1, z);
  scheduleWater(x, y - 1, z);
  scheduleWater(x, y, z + 1);
  scheduleWater(x, y, z - 1);
}

// ===== Гравітація сипких блоків (пісок, гравій) =====
// Зміна блока може позбавити сусіда опори — плануємо перевірку падіння.
const gravityQueue = new Set();

function scheduleGravity(x, y, z) {
  if (y >= 0 && y < HEIGHT) gravityQueue.add(x + ',' + y + ',' + z);
}

function scheduleGravityAround(x, y, z) {
  scheduleGravity(x, y, z);      // щойно поставлений сипкий блок може почати падати
  scheduleGravity(x, y + 1, z);  // блок над зміненою клітинкою міг утратити опору
}

const HORIZ_DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];

// Рівень, який потік може підтримувати: вода зверху тримає 3,
// інакше — максимальний сусідній рівень мінус один
function waterSupport(x, y, z) {
  if (isWaterId(blockAt(x, y + 1, z))) return 3;
  let best = 0;
  for (const [dx, dz] of HORIZ_DIRS) {
    const lvl = WATER_LEVEL[blockAt(x + dx, y, z + dz)] || 0;
    best = Math.max(best, lvl - 1);
  }
  return best;
}

function tickWaterCell(x, y, z) {
  const id = blockAt(x, y, z);
  if (!isWaterId(id)) return;
  let lvl = WATER_LEVEL[id];

  // Потік без підживлення висихає (джерела вічні)
  if (id !== WATER) {
    const support = waterSupport(x, y, z);
    if (support < lvl) {
      setBlock(x, y, z, support >= 1 ? FLOW_OF_LEVEL[support] : AIR);
      if (support < 1) return;
      lvl = support;
    }
  }

  // Тече вниз
  const below = blockAt(x, y - 1, z);
  if (below === AIR || (isWaterId(below) && below !== WATER && WATER_LEVEL[below] < 3)) {
    setBlock(x, y - 1, z, FLOW3);
    return;
  }

  // Розтікається вбік лише над твердою опорою (інакше тільки падає),
  // інакше падаючі стовпи розливалися б на кожній висоті — повінь
  if (isSolid(below) && lvl > 1) {
    for (const [dx, dz] of HORIZ_DIRS) {
      const nb = blockAt(x + dx, y, z + dz);
      if (nb === AIR || (isWaterId(nb) && nb !== WATER && WATER_LEVEL[nb] < lvl - 1)) {
        setBlock(x + dx, y, z + dz, FLOW_OF_LEVEL[lvl - 1]);
      }
    }
  }
}

function processWaterQueue() {
  if (waterQueue.size === 0) return;
  const batch = [...waterQueue].slice(0, 400);
  for (const key of batch) {
    waterQueue.delete(key);
    const [x, y, z] = key.split(',').map(Number);
    tickWaterCell(x, y, z);
  }
}

// ============================================================
// Симуляція лави: як вода, але тече повільніше й недалеко, а зустрівши
// воду — застигає в камінь (з парою й сичанням).
// ============================================================
const lavaQueue = new Set();

function scheduleLava(x, y, z) {
  if (y >= 0 && y < HEIGHT) lavaQueue.add(x + ',' + y + ',' + z);
}

function scheduleLavaAround(x, y, z) {
  scheduleLava(x, y, z);
  scheduleLava(x + 1, y, z);
  scheduleLava(x - 1, y, z);
  scheduleLava(x, y + 1, z);
  scheduleLava(x, y - 1, z);
  scheduleLava(x, y, z + 1);
  scheduleLava(x, y, z - 1);
}

// Лаву поряд із водою застигає в камінь (обидві клітинки, якщо потік)
function lavaMeetsWater(x, y, z, id) {
  for (const [dx, dy, dz] of [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]) {
    if (isWaterId(blockAt(x + dx, y + dy, z + dz))) {
      setBlock(x, y, z, STONE);
      spawnParticles(x + 0.5, y + 0.9, z + 0.5, SMOKE_COLOR, 8,
        { radius: 0.4, speed: 1.2, upBias: 1.4, life: 0.9, size: 0.14, gravity: -4 });
      Sound.lavaHiss();
      return true;
    }
  }
  return false;
}

function lavaSupport(x, y, z) {
  if (isLavaId(blockAt(x, y + 1, z))) return 3;   // лава згори тримає повний потік
  let best = 0;
  for (const [dx, dz] of HORIZ_DIRS) {
    const lvl = LAVA_LEVEL[blockAt(x + dx, y, z + dz)] || 0;
    best = Math.max(best, lvl - 1);
  }
  return best;
}

function tickLavaCell(x, y, z) {
  const id = blockAt(x, y, z);
  if (!isLavaId(id)) return;
  if (lavaMeetsWater(x, y, z, id)) return;   // зіткнення з водою → камінь

  let lvl = LAVA_LEVEL[id];

  // Потік без підживлення висихає (джерела вічні)
  if (id !== LAVA) {
    const support = lavaSupport(x, y, z);
    if (support < lvl) {
      setBlock(x, y, z, support >= 1 ? LFLOW_OF_LEVEL[support] : AIR);
      if (support < 1) return;
      lvl = support;
    }
  }

  // Тече вниз
  const below = blockAt(x, y - 1, z);
  if (below === AIR || (isLavaId(below) && below !== LAVA && LAVA_LEVEL[below] < 3)) {
    setBlock(x, y - 1, z, LFLOW3);
    return;
  }
  if (isWaterId(below)) { setBlock(x, y - 1, z, STONE); return; }

  // Розтікається вбік лише над твердою опорою (інакше тільки падає). Поріг
  // lvl > 2 (а не > 1, як у води) робить розлив коротшим — лише ~2 клітинки.
  if (isSolid(below) && lvl > 2) {
    for (const [dx, dz] of HORIZ_DIRS) {
      const nb = blockAt(x + dx, y, z + dz);
      if (nb === AIR || (isLavaId(nb) && nb !== LAVA && LAVA_LEVEL[nb] < lvl - 1)) {
        setBlock(x + dx, y, z + dz, LFLOW_OF_LEVEL[lvl - 1]);
      }
    }
  }
}

function processLavaQueue() {
  if (lavaQueue.size === 0) return;
  const batch = [...lavaQueue].slice(0, 200);
  for (const key of batch) {
    lavaQueue.delete(key);
    const [x, y, z] = key.split(',').map(Number);
    tickLavaCell(x, y, z);
  }
}

// ============================================================
// Текстурний атлас (малюється на canvas, без зовнішніх файлів)
// ============================================================
const TILE = 16, ATLAS_COLS = 4, ATLAS_ROWS = 6;
let atlasCanvas;

function makeAtlas() {
  atlasCanvas = document.createElement('canvas');
  atlasCanvas.width = ATLAS_COLS * TILE;
  atlasCanvas.height = ATLAS_ROWS * TILE;
  const ctx = atlasCanvas.getContext('2d');

  let rngState = 987654321;
  const rnd = () => {
    rngState = (Math.imul(rngState, 1103515245) + 12345) | 0;
    return ((rngState >>> 16) & 0x7fff) / 32768;
  };
  const vary = (r, g, b, a = 10) => {
    const d = Math.floor((rnd() * 2 - 1) * a);
    return `rgb(${r + d},${g + d},${b + d})`;
  };

  const paint = (i, fn) => {
    const ox = (i % ATLAS_COLS) * TILE, oy = Math.floor(i / ATLAS_COLS) * TILE;
    for (let y = 0; y < TILE; y++) {
      for (let x = 0; x < TILE; x++) {
        ctx.fillStyle = fn(x, y);
        ctx.fillRect(ox + x, oy + y, 1, 1);
      }
    }
  };

  paint(0, () => vary(106, 170, 64, 14));                                        // 0 трава (верх)
  paint(1, (x, y) => y < 3 ? vary(106, 170, 64, 14) : vary(134, 96, 67, 12));    // 1 трава (бік)
  paint(2, () => vary(134, 96, 67, 12));                                         // 2 земля
  paint(3, () => vary(125, 125, 125, 10));                                       // 3 камінь
  paint(4, () => vary(219, 207, 163, 8));                                        // 4 пісок
  paint(5, (x) => (x === 0 || x === TILE - 1) ? vary(85, 60, 32, 6) : vary(107, 84, 48, 8)); // 5 колода (бік)
  paint(6, (x, y) => (x > 3 && x < 12 && y > 3 && y < 12) ? vary(170, 138, 87, 8) : vary(107, 84, 48, 8)); // 6 колода (зріз)
  paint(7, () => vary(58, 121, 38, 18));                                         // 7 листя
  paint(8, () => vary(53, 95, 205, 8));                                          // 8 вода
  paint(9, (x, y) => (y % 4 === 3) ? vary(140, 110, 60, 5) : vary(166, 133, 80, 8)); // 9 дошки
  paint(10, (x, y) => (y >= 6 && y <= 9) ? vary(228, 222, 210, 6) : vary(178, 46, 40, 12)); // 10 динаміт (бік)
  paint(11, (x, y) => (x > 4 && x < 11 && y > 4 && y < 11) ? vary(120, 32, 28, 8) : vary(178, 46, 40, 12)); // 11 динаміт (верх)

  // Руди: камінь у фоні + детерміновані вкраплення кольору руди
  const oreTile = (i, speckColor, density) => {
    // власний ГВЧ на тайл, щоб малюнок руди був стабільним між запусками
    let s = (i * 2654435761) >>> 0;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const specks = new Set();
    for (let n = 0; n < density; n++) {
      specks.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    }
    paint(i, (x, y) => specks.has(x * TILE + y) ? speckColor(x, y) : vary(125, 125, 125, 10));
  };
  oreTile(12, () => vary(34, 34, 38, 8), 26);    // 12 вугілля
  oreTile(13, () => vary(196, 154, 116, 10), 24); // 13 залізо
  oreTile(14, () => vary(243, 207, 71, 10), 22);  // 14 золото
  oreTile(15, () => vary(98, 214, 214, 12), 20);  // 15 алмаз

  // Біомні блоки
  paint(16, () => vary(238, 242, 250, 6));                                        // 16 сніг
  paint(17, (x) => (x % 5 === 2) ? vary(40, 110, 46, 8) : vary(58, 138, 64, 10)); // 17 кактус (бік, ребра)
  paint(18, (x, y) => (x > 3 && x < 12 && y > 3 && y < 12)
    ? vary(92, 172, 96, 8) : vary(58, 138, 64, 10));                              // 18 кактус (зріз)

  // Гравій: сірувата основа з детермінованими темними та світлими камінцями
  {
    let s = 0x9e3779b1 >>> 0;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const dark = new Set(), light = new Set();
    for (let n = 0; n < 30; n++) dark.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    for (let n = 0; n < 18; n++) light.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    paint(19, (x, y) => {
      const k = x * TILE + y;
      if (dark.has(k)) return vary(96, 92, 88, 6);
      if (light.has(k)) return vary(180, 176, 170, 6);
      return vary(140, 134, 126, 8);
    });                                                                            // 19 гравій
  }

  // Лава: розжарена помаранчева маса з темнішою застиглою кіркою та яскравими
  // жовтими прожилками (детерміновано, нуль зовнішніх ассетів)
  {
    let s = 0xa53c9f11 >>> 0;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const crust = new Set(), hot = new Set();
    for (let n = 0; n < 34; n++) crust.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    for (let n = 0; n < 22; n++) hot.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    paint(20, (x, y) => {
      const k = x * TILE + y;
      if (hot.has(k)) return vary(255, 236, 130, 8);   // яскрава пляма
      if (crust.has(k)) return vary(120, 34, 12, 10);  // темна кірка
      return vary(226, 88, 24, 14);                    // розжарена маса
    });                                                                            // 20 лава
  }

  // Скло: майже прозоре нутро (альфа в текстурі), світла рамка по периметру
  // й пара діагональних відблисків. Прозорість дає альфа-канал canvas —
  // меш скла рендериться окремим матеріалом із transparent: true.
  paint(21, (x, y) => {
    const edge = x === 0 || y === 0 || x === TILE - 1 || y === TILE - 1;
    if (edge) return 'rgba(214,236,244,0.9)';                 // рамка
    if (x - y === 9 || x - y === 10) return 'rgba(255,255,255,0.45)'; // відблиск
    if (x - y === -6) return 'rgba(255,255,255,0.3)';
    return 'rgba(190,224,238,0.16)';                          // прозоре нутро
  });                                                                            // 21 скло

  // Вовна: тепла кремова основа з детермінованими «кучерями» — темнішими
  // завитками й світлими пухнастими плямами
  {
    let s = 0x5eedb217 >>> 0;
    const r = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
    const curls = new Set(), fluff = new Set();
    for (let n = 0; n < 26; n++) curls.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    for (let n = 0; n < 20; n++) fluff.add(Math.floor(r() * TILE) * TILE + Math.floor(r() * TILE));
    paint(22, (x, y) => {
      const k = x * TILE + y;
      if (curls.has(k)) return vary(206, 200, 188, 6);   // тінь завитка
      if (fluff.has(k)) return vary(246, 244, 238, 4);   // світлий пух
      return vary(232, 228, 219, 6);                     // кремова основа
    });                                                                          // 22 вовна
  }

  const tex = new THREE.CanvasTexture(atlasCanvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Який тайл атласу використовує блок для верху / низу / боків
const BLOCK_TILES = {
  [GRASS]:  { top: 0, bottom: 2, side: 1 },
  [DIRT]:   { top: 2, bottom: 2, side: 2 },
  [STONE]:  { top: 3, bottom: 3, side: 3 },
  [SAND]:   { top: 4, bottom: 4, side: 4 },
  [LOG]:    { top: 6, bottom: 6, side: 5 },
  [LEAVES]: { top: 7, bottom: 7, side: 7 },
  [WATER]:  { top: 8, bottom: 8, side: 8 },
  [PLANK]:  { top: 9, bottom: 9, side: 9 },
  [FLOW3]:  { top: 8, bottom: 8, side: 8 },
  [FLOW2]:  { top: 8, bottom: 8, side: 8 },
  [FLOW1]:  { top: 8, bottom: 8, side: 8 },
  [TNT]:    { top: 11, bottom: 11, side: 10 },
  [COAL]:    { top: 12, bottom: 12, side: 12 },
  [IRON]:    { top: 13, bottom: 13, side: 13 },
  [GOLD]:    { top: 14, bottom: 14, side: 14 },
  [DIAMOND]: { top: 15, bottom: 15, side: 15 },
  [SNOW]:    { top: 16, bottom: 16, side: 16 },
  [CACTUS]:  { top: 18, bottom: 18, side: 17 },
  [GRAVEL]:  { top: 19, bottom: 19, side: 19 },
  [LAVA]:    { top: 20, bottom: 20, side: 20 },
  [LFLOW3]:  { top: 20, bottom: 20, side: 20 },
  [LFLOW2]:  { top: 20, bottom: 20, side: 20 },
  [LFLOW1]:  { top: 20, bottom: 20, side: 20 },
  [GLASS]:   { top: 21, bottom: 21, side: 21 },
  [WOOL]:    { top: 22, bottom: 22, side: 22 },
};

function tileUV(tile) {
  const col = tile % ATLAS_COLS, row = Math.floor(tile / ATLAS_COLS);
  return {
    u0: col / ATLAS_COLS, u1: (col + 1) / ATLAS_COLS,
    v0: 1 - (row + 1) / ATLAS_ROWS, v1: 1 - row / ATLAS_ROWS,
  };
}

// ============================================================
// Побудова мешів чанків
// ============================================================
// Для кожної грані: напрямок до сусіда, 4 вершини (CCW зовні), тип грані
const FACES = [
  { dir: [1, 0, 0],  face: 'side',   verts: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]] },
  { dir: [-1, 0, 0], face: 'side',   verts: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]] },
  { dir: [0, 1, 0],  face: 'top',    verts: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]] },
  { dir: [0, -1, 0], face: 'bottom', verts: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]] },
  { dir: [0, 0, 1],  face: 'side',   verts: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]] },
  { dir: [0, 0, -1], face: 'side',   verts: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]] },
];

function buildChunkMesh(cx, cz, scene, materials) {
  const data = getChunkData(cx, cz);
  const wx0 = cx * CHUNK, wz0 = cz * CHUNK;

  const solid = { pos: [], norm: [], uv: [], idx: [] };
  const water = { pos: [], norm: [], uv: [], idx: [] };
  const lava = { pos: [], norm: [], uv: [], idx: [] };
  const glass = { pos: [], norm: [], uv: [], idx: [] };

  for (let ly = 0; ly < HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = data[blockIndex(lx, ly, lz)];
        if (id === AIR) continue;
        const wx = wx0 + lx, wz = wz0 + lz;

        const idWater = isWaterId(id), idLava = isLavaId(id), idFluid = idWater || idLava;
        const idGlass = id === GLASS;
        for (const { dir, face, verts } of FACES) {
          const nb = blockAt(wx + dir[0], ly + dir[1], wz + dir[2]);
          // Флюїд показує грань до повітря, скла або флюїду іншого типу (межа
          // вода/лава); скло — лише до повітря чи флюїду (грані скло-скло та
          // скло-непрозоре ховаються — вітраж без швів); непрозорі тверді —
          // до повітря, флюїду чи скла (їх видно крізь скло).
          const visible = idFluid
            ? nb === AIR || nb === GLASS || (isFluid(nb) && isWaterId(nb) !== idWater)
            : idGlass
              ? nb === AIR || isFluid(nb)
              : nb === AIR || isFluid(nb) || nb === GLASS;
          if (!visible) continue;

          const buf = idLava ? lava : idWater ? water : idGlass ? glass : solid;
          const { u0, u1, v0, v1 } = tileUV(BLOCK_TILES[id][face]);
          const uvCorners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          const base = buf.pos.length / 3;

          for (let i = 0; i < 4; i++) {
            const v = verts[i];
            // Верх флюїду трохи нижче, щоб було видно поверхню
            const yOff = idFluid && v[1] === 1 ? -0.12 : 0;
            buf.pos.push(lx + v[0], ly + v[1] + yOff, lz + v[2]);
            buf.norm.push(dir[0], dir[1], dir[2]);
            buf.uv.push(uvCorners[i][0], uvCorners[i][1]);
          }
          buf.idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
  }

  const makeMesh = (buf, material) => {
    if (buf.idx.length === 0) return null;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(buf.pos), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(buf.norm), 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(buf.uv), 2));
    geo.setIndex(buf.idx);
    const mesh = new THREE.Mesh(geo, material);
    mesh.position.set(wx0, 0, wz0);
    scene.add(mesh);
    return mesh;
  };

  return {
    solid: makeMesh(solid, materials.solid),
    water: makeMesh(water, materials.water),
    lava: makeMesh(lava, materials.lava),
    glass: makeMesh(glass, materials.glass),
  };
}

function disposeChunkMesh(entry, scene) {
  for (const mesh of [entry.solid, entry.water, entry.lava, entry.glass]) {
    if (!mesh) continue;
    scene.remove(mesh);
    mesh.geometry.dispose();
  }
}

// ============================================================
// Гра
// ============================================================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer({ antialias: false });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
document.body.appendChild(renderer.domElement);

const atlasTexture = makeAtlas();
const materials = {
  solid: new THREE.MeshLambertMaterial({ map: atlasTexture }),
  water: new THREE.MeshLambertMaterial({ map: atlasTexture, transparent: true, opacity: 0.7 }),
  // Лава світиться сама (не залежить від освітлення) — розжарений вигляд удень і вночі
  lava: new THREE.MeshBasicMaterial({ map: atlasTexture }),
  // Скло: прозорість задає альфа-канал тайла в атласі; depthWrite вимкнено,
  // щоб ближче скло не «затирало» дальші шибки в межах одного меша чанка
  glass: new THREE.MeshLambertMaterial({ map: atlasTexture, transparent: true, depthWrite: false }),
};

// Освітлення
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
scene.add(sun);
const hemi = new THREE.HemisphereLight(0xbfd9ff, 0x6b5640, 0.8);
scene.add(hemi);

scene.fog = new THREE.Fog(0x87ceeb, RENDER_DIST * CHUNK * 0.5, RENDER_DIST * CHUNK);

// Підсвічування блока під прицілом
const highlight = new THREE.LineSegments(
  new THREE.EdgesGeometry(new THREE.BoxGeometry(1.002, 1.002, 1.002)),
  new THREE.LineBasicMaterial({ color: 0x000000 })
);
highlight.visible = false;
scene.add(highlight);

// ===== Оверлей тріщин при видобутку =====
const CRACK_STAGES = 10;

function makeCrackTexture() {
  const size = 16;
  const cv = document.createElement('canvas');
  cv.width = CRACK_STAGES * size;
  cv.height = size;
  const ctx = cv.getContext('2d');

  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return ((seed >>> 8) & 0xffff) / 0x10000;
  };

  // Одна нова тріщина на стадію; пізніші стадії містять усі попередні
  const cracks = [];
  for (let s = 0; s < CRACK_STAGES; s++) {
    const pts = [];
    let x = rnd() * size, y = rnd() * size;
    pts.push([x, y]);
    const segs = 2 + Math.floor(rnd() * 3);
    for (let i = 0; i < segs; i++) {
      x = Math.max(0, Math.min(size, x + (rnd() - 0.5) * 9));
      y = Math.max(0, Math.min(size, y + (rnd() - 0.5) * 9));
      pts.push([x, y]);
    }
    cracks.push(pts);
  }

  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1;
  for (let s = 0; s < CRACK_STAGES; s++) {
    const ox = s * size;
    for (let c = 0; c <= s; c++) {
      const pts = cracks[c];
      ctx.beginPath();
      ctx.moveTo(ox + pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(ox + pts[i][0], pts[i][1]);
      ctx.stroke();
    }
  }

  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(1 / CRACK_STAGES, 1);
  return tex;
}

const crackTexture = makeCrackTexture();
const crackMesh = new THREE.Mesh(
  new THREE.BoxGeometry(1.004, 1.004, 1.004),
  new THREE.MeshBasicMaterial({
    map: crackTexture,
    transparent: true,
    opacity: 0.8,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    fog: false,
  })
);
crackMesh.visible = false;
scene.add(crackMesh);

// ===== Модель кирки від першої особи =====
// Рендериться окремою сценою поверх світу (з очищенням глибини),
// тож не провалюється в блоки біля стіни й завжди добре освітлена
const viewScene = new THREE.Scene();
const viewCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.01, 10);
viewScene.add(new THREE.HemisphereLight(0xffffff, 0x707070, 1.1));
const viewLight = new THREE.DirectionalLight(0xffffff, 0.7);
viewLight.position.set(0.6, 1, 0.8);
viewScene.add(viewLight);

function makePickaxe() {
  const g = new THREE.Group();
  const handleMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const headMat = new THREE.MeshLambertMaterial({ color: 0x9099a3 });

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.62, 0.07), handleMat);
  g.add(handle);

  // Голівка кирки: поперечка з двома загнутими «дзьобами». Повертаємо її навколо
  // вертикалі, щоб передній дзьоб дивився на блок (углиб екрана), а не широким
  // боком — раніше кирка «била боком».
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.3, 0);
  headGroup.rotation.y = 0.8;
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.09, 0.09), headMat);
  headGroup.add(head);
  const tip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 0.08), headMat);
  tip.position.set(0.26, -0.03, 0);
  tip.rotation.z = 0.5;                               // передній дзьоб, загнутий донизу
  headGroup.add(tip);
  const tip2 = tip.clone();
  tip2.position.x = -0.26;
  tip2.rotation.z = -0.5;                             // задній дзьоб
  headGroup.add(tip2);
  g.add(headGroup);

  return g;
}

const viewModel = makePickaxe();
const VIEW_BASE_POS = new THREE.Vector3(0.42, -0.42, -0.85);
const VIEW_BASE_ROT = new THREE.Euler(0.3, -0.35, 0.35);
viewModel.position.copy(VIEW_BASE_POS);
viewModel.rotation.copy(VIEW_BASE_ROT);
viewScene.add(viewModel);

// ===== Модель лука від першої особи =====
// Дуга з тора, тятива та накладена стріла; під час натягу стріла й тятива
// відходять до гравця, а лук трохи піднімається до прицілу.
function makeBowView() {
  const g = new THREE.Group();
  const wood = new THREE.MeshLambertMaterial({ color: 0x7a4a22 });
  // Дуга у вертикальній площині Y-Z (вздовж прицілу): її видно з ребра збоку,
  // опуклістю вперед (-Z), а відкритою хордою — до гравця (+Z)
  const frame = new THREE.Group();
  const limb = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.022, 6, 18, Math.PI * 1.25), wood);
  limb.rotation.z = -Math.PI * 1.25 / 2;             // симетрична дуга, опуклістю в +X
  frame.add(limb);
  frame.rotation.y = Math.PI / 2;                    // площину дуги повертаємо в Y-Z (+X -> -Z)
  g.add(frame);
  // Тятива — два відрізки від кінців дуги до точки накладання стріли; під час
  // натягу та точка відходить назад і тятива згинається в «галочку»
  const stringMat = new THREE.MeshBasicMaterial({ color: 0xe8e8e8 });
  const stringTop = new THREE.Mesh(new THREE.BoxGeometry(0.006, 1, 0.006), stringMat);
  const stringBot = new THREE.Mesh(new THREE.BoxGeometry(0.006, 1, 0.006), stringMat);
  g.add(stringTop);
  g.add(stringBot);
  // Накладена стріла: вістрям уперед (-Z у viewCamera)
  const nock = new THREE.Group();
  nock.position.z = BOW_NOCK_Z;
  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(0.013, 0.013, 0.46, 5),
    new THREE.MeshLambertMaterial({ color: 0xc9a66b })
  );
  shaft.rotation.x = Math.PI / 2;
  shaft.position.z = -0.23;
  nock.add(shaft);
  const tip = new THREE.Mesh(
    new THREE.ConeGeometry(0.03, 0.08, 5),
    new THREE.MeshLambertMaterial({ color: 0x6b6f78 })
  );
  tip.rotation.x = -Math.PI / 2;
  tip.position.z = -0.5;
  nock.add(tip);
  g.add(nock);
  return { group: g, nock, stringTop, stringBot };
}

// Кінці дуги (точки кріплення тятиви) та позиція накладеної стріли у спокої
const BOW_TIP_Y = 0.277;
const BOW_TIP_Z = 0.115;
const BOW_NOCK_Z = 0.11;

// Розтягнути тонкий відрізок-«коробку» (висотою 1 по Y) між точками A та B
const _segDir = new THREE.Vector3();
const _segUp = new THREE.Vector3(0, 1, 0);
function stretchSegment(seg, ax, ay, az, bx, by, bz) {
  _segDir.set(bx - ax, by - ay, bz - az);
  const len = _segDir.length() || 1e-4;
  seg.position.set(ax + _segDir.x * 0.5, ay + _segDir.y * 0.5, az + _segDir.z * 0.5);
  seg.quaternion.setFromUnitVectors(_segUp, _segDir.divideScalar(len));
  seg.scale.set(1, len, 1);
}

// Перерахувати тятиву під поточний натяг: верхній і нижній відрізки сходяться
// в точці накладання стріли (зміщеній назад на drawZ)
function updateBowString(drawZ) {
  stretchSegment(bowView.stringTop, 0, BOW_TIP_Y, BOW_TIP_Z, 0, 0, drawZ);
  stretchSegment(bowView.stringBot, 0, -BOW_TIP_Y, BOW_TIP_Z, 0, 0, drawZ);
}

const bowView = makeBowView();
const BOW_VIEW_POS = new THREE.Vector3(0.3, -0.3, -0.72);
const BOW_VIEW_ROT = new THREE.Euler(0.05, -0.12, 0);
bowView.group.position.copy(BOW_VIEW_POS);
bowView.group.rotation.copy(BOW_VIEW_ROT);
bowView.group.visible = false;
updateBowString(BOW_NOCK_Z);        // тятива у позі спокою (пряма)
viewScene.add(bowView.group);

// ===== Модель вудки від першої особи =====
// Дерев'яне вудлище з невеликою котушкою; кінчик (tip) — точка, від якої
// у світі малюється волосінь до поплавка. Нуль зовнішніх ассетів.
function makeRodView() {
  const g = new THREE.Group();
  const rodMat = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
  const reelMat = new THREE.MeshLambertMaterial({ color: 0x3a3a3a });
  // Вудлище — тонкий довгий брусок, нахилений уперед-угору
  const rod = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.045, 1.05), rodMat);
  rod.position.set(0, 0, -0.5);
  rod.rotation.x = -0.32;
  g.add(rod);
  // Котушка коло руків'я
  const reel = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 8), reelMat);
  reel.rotation.z = Math.PI / 2;
  reel.position.set(0.03, -0.05, -0.08);
  g.add(reel);
  // Кінчик вудлища — порожній об'єкт для прив'язки волосіні
  const tip = new THREE.Object3D();
  tip.position.set(0, 0.32, -0.98);
  g.add(tip);
  return { group: g, tip };
}

const rodView = makeRodView();
const ROD_VIEW_POS = new THREE.Vector3(0.34, -0.34, -0.5);
const ROD_VIEW_ROT = new THREE.Euler(0.0, -0.1, 0.15);
rodView.group.position.copy(ROD_VIEW_POS);
rodView.group.rotation.copy(ROD_VIEW_ROT);
rodView.group.visible = false;
viewScene.add(rodView.group);

// Стан маху киркою
const swing = { active: false, t: 0 };
const SWING_DUR = 0.28;
function triggerSwing() {
  if (!swing.active) {
    swing.active = true;
    swing.t = 0;
  }
}

let bobPhase = 0;

function updateViewModel(dt) {
  // Перемикання між киркою, луком та вудкою за активним предметом хотбара
  const holdingBow = hotbar[selectedSlot] === BOW;
  const holdingRod = hotbar[selectedSlot] === ROD;
  viewModel.visible = !holdingBow && !holdingRod;
  bowView.group.visible = holdingBow;
  rodView.group.visible = holdingRod;
  if (holdingRod) {
    // Легкий замах при закиданні; інакше — спокійна поза з тремтінням волосіні
    if (swing.active) {
      swing.t += dt / SWING_DUR;
      if (swing.t >= 1) { swing.active = false; swing.t = 0; }
    }
    const s = swing.active ? Math.sin(swing.t * Math.PI) : 0;
    rodView.group.position.set(
      ROD_VIEW_POS.x,
      ROD_VIEW_POS.y + s * 0.06,
      ROD_VIEW_POS.z + s * 0.08
    );
    rodView.group.rotation.set(
      ROD_VIEW_ROT.x - s * 0.5,
      ROD_VIEW_ROT.y,
      ROD_VIEW_ROT.z
    );
    return;
  }
  if (holdingBow) {
    const c = bow.drawing ? bow.charge : 0;               // 0..1 натяг
    const drawZ = BOW_NOCK_Z + c * 0.2;                   // точка накладання відходить назад
    bowView.nock.position.z = drawZ;                      // стріла йде разом із тятивою
    updateBowString(drawZ);                               // тятива згинається в «галочку»
    bowView.group.position.set(
      BOW_VIEW_POS.x - c * 0.07,
      BOW_VIEW_POS.y + c * 0.05,
      BOW_VIEW_POS.z + c * 0.04
    );
    // Легке тремтіння повністю натягнутого лука
    if (c > 0.98) bowView.group.position.x += Math.sin(bobPhase * 8) * 0.004;
    return;
  }

  // Прогрес маху; під час видобутку — безперервно
  if (swing.active) {
    swing.t += dt / SWING_DUR;
    if (swing.t >= 1) {
      if (mining) swing.t -= 1;
      else { swing.active = false; swing.t = 0; }
    }
  }
  const s = swing.active ? Math.sin(swing.t * Math.PI) : 0;

  // Похитування при ходьбі по землі
  const speed = Math.hypot(player.vel.x, player.vel.z);
  if (speed > 0.5 && player.onGround) bobPhase += dt * 9;
  const bob = Math.min(speed, 6) * 0.004;

  viewModel.position.set(
    VIEW_BASE_POS.x - s * 0.05 + Math.cos(bobPhase) * bob,
    VIEW_BASE_POS.y + s * 0.06 + Math.abs(Math.sin(bobPhase)) * bob,
    VIEW_BASE_POS.z + s * 0.06
  );
  viewModel.rotation.set(
    VIEW_BASE_ROT.x - s * 1.2,
    VIEW_BASE_ROT.y + s * 0.25,
    VIEW_BASE_ROT.z
  );
}

// ===== Гравець =====
const PLAYER_W = 0.3;   // пів-ширини
const PLAYER_H = 1.8;
const EYE = 1.62;
const EPS = 0.001;

// ===== Виживання: здоров'я, повітря, шкода =====
const MAX_HEALTH = 20;          // 10 сердець (по 2 одиниці кожне)
const MAX_AIR = 11;             // запас повітря в секундах (10 бульбашок)
const MAX_HUNGER = 20;          // 10 «ніжок» (по 2 одиниці кожна)
const FOOD_MAX = 64;            // максимум сирого м'яса в торбі
const EAT_AMOUNT = 6;           // скільки голоду відновлює одна порція (3 ніжки)
const EAT_COOLDOWN = 0.9;       // пауза між поїданнями, с
const HUNGER_PER_EXHAUSTION = 4; // одиниць виснаження на 1 одиницю голоду
const FALL_SAFE = 3;            // блоки падіння без шкоди
const SPAWN = { x: 8, z: 8 };
// Точка відродження: null — стандартний спавн; інакше {x,z} закріплене ліжком (сном)
let spawnPoint = (savedGame && savedGame.spawn &&
                  Number.isFinite(savedGame.spawn.x) && Number.isFinite(savedGame.spawn.z))
  ? { x: savedGame.spawn.x, z: savedGame.spawn.z }
  : null;

const player = {
  pos: new THREE.Vector3(8.5, heightAt(8, 8) + 2, 8.5),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: false,
  halfW: PLAYER_W,
  height: PLAYER_H,
  // стан виживання
  health: MAX_HEALTH,
  air: MAX_AIR,
  hunger: MAX_HUNGER,   // голод: спадає від активності
  exhaustion: 0,        // накопичене виснаження; на порозі знімає 1 голод
  food: 0,              // зібране сире м'ясо (їжа)
  starveTick: 0,        // таймер шкоди від голоду
  eatTimer: 0,          // перезарядка поїдання
  dead: false,
  invuln: 0,        // короткі кадри невразливості після удару
  hurtFlash: 0,     // інтенсивність червоного спалаху (0..1)
  fireTicks: 0,     // час, поки гравець горить (лава); догорає й поза лавою
  fireDmgTick: 0,   // таймер шкоди від вогню
  sinceHurt: 999,   // секунд від останньої шкоди (для регенерації)
  regenTick: 0,
  drownTick: 0,
  fallPeakY: 0,     // найвища точка під час падіння
  prevOnGround: true,
  prevInWater: false, // для звуку сплеску при зануренні
  stepDist: 0,      // накопичена відстань для звуку кроків
  lastCause: '',
  flying: false,    // творчий політ (подвійний Space): без гравітації й шкоди від падіння
  climbed: 0,       // накопичений підйом драбиною (для досягнення)
};
player.fallPeakY = player.pos.y;

if (savedGame && savedGame.player) {
  const p = savedGame.player;
  if ([p.x, p.y, p.z].every(Number.isFinite)) {
    player.pos.set(p.x, p.y, p.z);
    player.yaw = p.yaw || 0;
    player.pitch = p.pitch || 0;
  }
  // Здоров'я: не завантажувати мертвим — пусте/нульове = повне
  if (Number.isFinite(p.health) && p.health > 0) {
    player.health = Math.min(MAX_HEALTH, p.health);
  }
  if (Number.isFinite(p.hunger)) {
    player.hunger = THREE.MathUtils.clamp(p.hunger, 0, MAX_HUNGER);
  }
  if (Number.isFinite(p.food)) {
    player.food = THREE.MathUtils.clamp(Math.floor(p.food), 0, FOOD_MAX);
  }
  player.flying = !!p.flying;
}
player.fallPeakY = player.pos.y;

const keys = {};
let selectedSlot = 0;
let hotbar = [...DEFAULT_HOTBAR];
let blockMenuOpen = false;

// Сенсорні пристрої: pointer lock недоступний, керування через віртуальний джойстик
const IS_TOUCH = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
let mobilePlaying = false;
const joy = { active: false, id: null, x: 0, y: 0 };

// ===== Колізії (по осях), спільні для гравця і тварин =====
function moveEntityAxis(e, axis, amount) {
  if (amount === 0) return false;
  e.pos[axis] += amount;
  const x0 = Math.floor(e.pos.x - e.halfW), x1 = Math.floor(e.pos.x + e.halfW);
  const y0 = Math.floor(e.pos.y), y1 = Math.floor(e.pos.y + e.height);
  const z0 = Math.floor(e.pos.z - e.halfW), z1 = Math.floor(e.pos.z + e.halfW);
  for (let x = x0; x <= x1; x++) {
    for (let y = y0; y <= y1; y++) {
      for (let z = z0; z <= z1; z++) {
        if (!isSolid(blockAt(x, y, z)) && !doorBlocksCell(x, y, z) &&
            !fenceBlocksCell(x, y, z)) continue;
        if (axis === 'x') {
          e.pos.x = amount > 0 ? x - e.halfW - EPS : x + 1 + e.halfW + EPS;
        } else if (axis === 'z') {
          e.pos.z = amount > 0 ? z - e.halfW - EPS : z + 1 + e.halfW + EPS;
        } else {
          if (amount > 0) {
            e.pos.y = y - e.height - EPS;
          } else {
            e.pos.y = y + 1 + EPS;
            e.onGround = true;
          }
        }
        e.vel[axis] = 0;
        return true;
      }
    }
  }
  return false;
}

// Творчий політ: перемикається подвійним Space (десктоп) або подвійним тапом
// по кнопці стрибка (сенсор). У польоті немає гравітації й шкоди від падіння.
function toggleFlight() {
  if (player.dead || sleeping) return;
  player.flying = !player.flying;
  player.vel.y = 0;
  player.fallPeakY = player.pos.y;   // скидаємо арку падіння на момент перемикання
  if (player.flying) unlockAch('fly');
}

function updatePlayer(dt) {
  // Пливемо в човні: власна фізика гравця вимкнена, кермуємо човном
  if (ridingBoat) {
    driveBoat(dt);
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    return;
  }

  // Їдемо верхи: власна фізика гравця вимкнена, кермуємо конем
  if (ridingHorse) {
    driveHorse(dt);
    camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
    camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
    return;
  }

  const feetId = blockAt(
    Math.floor(player.pos.x),
    Math.floor(player.pos.y + 0.4),
    Math.floor(player.pos.z)
  );
  const inWater = isWaterId(feetId);
  const inLava = isLavaId(feetId);       // у лаві рух в'язкий і повільний
  const inLiquid = inWater || inLava;

  const flying = player.flying;
  const running = keys['ShiftLeft'] || keys['ShiftRight'];
  const onLadder = !flying && playerOnLadder();

  // Горизонтальний рух (у польоті трохи швидше; Shift у польоті — знижуватися, тож не пришвидшує)
  const speed = flying ? 7 : (running ? 8 : 5);
  let fx = 0, fz = 0;
  if (keys['KeyW']) fz -= 1;
  if (keys['KeyS']) fz += 1;
  if (keys['KeyA']) fx -= 1;
  if (keys['KeyD']) fx += 1;
  if (joy.active) { fx = joy.x; fz = joy.y; }
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }

  const moveMult = flying ? 1 : (inLava ? 0.35 : inWater ? 0.6 : 1);
  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = (fx * cos + fz * sin) * speed * moveMult;
  player.vel.z = (-fx * sin + fz * cos) * speed * moveMult;

  // Вертикальний рух
  if (flying) {
    // Політ: Space — угору, Shift — униз, інакше зависаємо. Без гравітації.
    const FLY_V = 7;
    player.vel.y = (keys['Space'] ? FLY_V : 0) - (running ? FLY_V : 0);
    player.fallPeakY = player.pos.y;   // без накопичення шкоди від падіння
  } else if (onLadder) {
    // Лазіння: W/Space (сенсор — джойстик уперед) — угору, Shift — униз,
    // без клавіш — повільне сповзання. Гравітація не діє.
    if (keys['KeyW'] || keys['Space'] || (joy.active && joy.y < -0.3)) {
      player.vel.y = LADDER_CLIMB_V;
    } else if (running) {
      player.vel.y = -LADDER_CLIMB_V;
    } else {
      player.vel.y = Math.max(player.vel.y - 18 * dt, LADDER_SLIDE_V);
    }
  } else if (inLiquid) {
    // У лаві занурюєшся й вибираєшся ще повільніше, ніж у воді
    const up = inLava ? 2.6 : 4;
    const sink = inLava ? -1.2 : -2.5;
    player.vel.y = keys['Space'] ? up : Math.max(player.vel.y - 12 * dt, sink);
  } else {
    player.vel.y -= 24 * dt;
    player.vel.y = Math.max(player.vel.y, -50);
    if (keys['Space'] && player.onGround) {
      player.vel.y = 8.2; Sound.jump();
      player.exhaustion += keys['ShiftLeft'] || keys['ShiftRight'] ? 0.8 : 0.2;
    }
  }

  // Звук сплеску при зануренні у воду (у лаву — сичання нижче, у updateSurvival)
  if (inWater && !player.prevInWater) Sound.splash();
  player.prevInWater = inWater;

  const yBefore = player.pos.y;
  player.onGround = false;
  moveEntityAxis(player, 'y', player.vel.y * dt);
  moveEntityAxis(player, 'x', player.vel.x * dt);
  moveEntityAxis(player, 'z', player.vel.z * dt);

  // Лазіння драбиною: рип щаблів, здобуток за підйом, нуль шкоди від падіння
  if (onLadder) {
    const dy = player.pos.y - yBefore;
    if (dy > 0) {
      player.climbed += dy;
      if (player.climbed >= 2.5) unlockAch('climb');
    }
    player.stepDist += Math.abs(dy);
    if (player.stepDist > 1.6) {
      player.stepDist = 0;
      Sound.step(LOG);
    }
    player.fallPeakY = player.pos.y;   // драбина гасить арку падіння
  }

  // Якщо провалилися під світ — повернути на поверхню (без шкоди від падіння)
  if (player.pos.y < -10) {
    player.pos.set(player.pos.x, HEIGHT, player.pos.z);
    player.vel.set(0, 0, 0);
    player.fallPeakY = player.pos.y;
  }

  // Звук кроків: накопичуємо пройдену відстань і цокаємо що ~2.4 блоки
  const groundId = blockAt(
    Math.floor(player.pos.x), Math.floor(player.pos.y - 0.1), Math.floor(player.pos.z)
  );
  if (player.onGround && !inLiquid) {
    player.stepDist += Math.hypot(player.vel.x, player.vel.z) * dt;
    if (player.stepDist > 2.4) {
      player.stepDist = 0;
      if (isSolid(groundId)) Sound.step(groundId);
    }
  } else if (!onLadder) {
    player.stepDist = 0;
  }

  // Шкода від падіння: рахуємо висоту арки між відривом і приземленням
  if (player.onGround) {
    if (!player.prevOnGround) {
      const fall = player.fallPeakY - player.pos.y;
      if (!inLiquid && fall > 0.4) Sound.land(); // звук приземлення
      if (fall > FALL_SAFE && !inLiquid) {
        damagePlayer(Math.floor(fall - FALL_SAFE), 'fall');
      }
    }
    player.fallPeakY = player.pos.y;
  } else {
    player.fallPeakY = Math.max(player.fallPeakY, player.pos.y);
  }
  player.prevOnGround = player.onGround;

  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
}

// ===== Виживання: повітря, регенерація, шкода, смерть =====
function damagePlayer(amount, cause) {
  if (player.dead || amount <= 0) return;
  if (player.invuln > 0 && cause !== 'drown') return;
  player.health = Math.max(0, player.health - amount);
  player.hurtFlash = 1;
  Sound.hurt();
  player.invuln = 0.5;
  player.sinceHurt = 0;
  player.lastCause = cause || '';
  unlockAch('ouch');
  if (player.health <= 0) die();
}

// Знаходить безпечну висоту над поверхнею для координат (x, z)
function safeSpawnY(x, z) {
  for (let y = HEIGHT - 1; y > 0; y--) {
    if (isSolid(blockAt(x, y, z))) return y + 1;
  }
  return SEA + 2;
}

function die() {
  if (player.dead) return;
  player.dead = true;
  player.vel.set(0, 0, 0);
  dismountBoat(false);   // випасти з човна, не переміщуючи тіло
  dismountHorse(false);  // випасти з сідла
  mining = false;
  cancelBowDraw();
  reelIn();
  resetMining();
  if (isLocked()) document.exitPointerLock();
  unlockAch('death');
  showDeathScreen(player.lastCause);
}

function respawn() {
  player.health = MAX_HEALTH;
  player.air = MAX_AIR;
  player.hunger = MAX_HUNGER;
  player.exhaustion = 0;
  player.starveTick = 0;
  player.eatTimer = 0;
  player.invuln = 1.5;
  player.hurtFlash = 0;
  player.fireTicks = 0;
  player.fireDmgTick = 0;
  player.sinceHurt = 999;
  player.dead = false;
  player.flying = false;
  // Відродження біля ліжка (сон закріпив точку), інакше — стандартний спавн
  const rx = spawnPoint ? spawnPoint.x : SPAWN.x;
  const rz = spawnPoint ? spawnPoint.z : SPAWN.z;
  const sy = safeSpawnY(rx, rz);
  player.pos.set(rx + 0.5, sy, rz + 0.5);
  player.vel.set(0, 0, 0);
  player.fallPeakY = player.pos.y;
  player.prevOnGround = true;
  hideDeathScreen();
  if (!mobilePlaying && renderer.domElement.requestPointerLock) {
    renderer.domElement.requestPointerLock();
  }
}

function updateSurvival(dt) {
  if (player.hurtFlash > 0) player.hurtFlash = Math.max(0, player.hurtFlash - dt * 2);
  if (player.invuln > 0) player.invuln -= dt;
  player.sinceHurt += dt;

  // ===== Лава: горіння =====
  // Дотик тілом до лави підпалює гравця; вогонь догорає ще кілька секунд
  // навіть після виходу (як у Minecraft). Шкода йде періодично.
  const px = Math.floor(player.pos.x), pz = Math.floor(player.pos.z);
  const inLavaBody = isLavaId(blockAt(px, Math.floor(player.pos.y + 0.4), pz)) ||
                     isLavaId(blockAt(px, Math.floor(player.pos.y + EYE), pz));
  if (inLavaBody) { player.fireTicks = Math.max(player.fireTicks, 3); unlockAch('lava'); }
  if (player.fireTicks > 0) {
    player.fireTicks = Math.max(0, player.fireTicks - dt);
    player.fireDmgTick -= dt;
    if (player.fireDmgTick <= 0) {
      player.fireDmgTick = 0.4;
      damagePlayer(inLavaBody ? 2 : 1, 'lava');
    }
    // Полум'я довкола гравця
    if (Math.random() < dt * 26) {
      spawnParticles(player.pos.x + (Math.random() - 0.5) * 0.6, player.pos.y + Math.random() * 1.4,
        player.pos.z + (Math.random() - 0.5) * 0.6, LAVA_FIRE_COLOR, 1,
        { radius: 0.1, speed: 0.6, upBias: 1.4, life: 0.5, size: 0.13, gravity: -6 });
    }
  }

  // Чи занурена голова під воду (рівень очей)
  const headWater = isWaterId(blockAt(
    Math.floor(player.pos.x),
    Math.floor(player.pos.y + EYE),
    Math.floor(player.pos.z)
  ));

  if (headWater) {
    player.air -= dt;
    if (player.air <= 0) {
      player.air = 0;
      player.drownTick -= dt;
      if (player.drownTick <= 0) {
        damagePlayer(2, 'drown');
        player.drownTick = 1;
      }
    }
  } else {
    player.air = Math.min(MAX_AIR, player.air + dt * 4);
    player.drownTick = 0;
  }

  // ===== Голод =====
  if (player.eatTimer > 0) player.eatTimer = Math.max(0, player.eatTimer - dt);

  // Виснаження накопичується від руху (біг — швидше); на порозі знімає голод
  const hSpeed = Math.hypot(player.vel.x, player.vel.z);
  player.exhaustion += hSpeed * dt * 0.05;
  while (player.exhaustion >= HUNGER_PER_EXHAUSTION) {
    player.exhaustion -= HUNGER_PER_EXHAUSTION;
    player.hunger = Math.max(0, player.hunger - 1);
  }

  // Голодування: коли шкала порожня — повільна шкода (але не на смерть)
  if (player.hunger <= 0) {
    player.starveTick -= dt;
    if (player.starveTick <= 0) {
      player.starveTick = 4;
      if (player.health > 1) damagePlayer(1, 'starve');
    }
  } else {
    player.starveTick = 0;
  }

  // Природна регенерація: коли давно не били, не тонемо й ситі.
  // Лікування «спалює» їжу — додає виснаження, тож не нескінченне.
  if (player.health > 0 && player.health < MAX_HEALTH &&
      player.sinceHurt > 4 && !headWater && player.hunger >= 16) {
    player.regenTick -= dt;
    if (player.regenTick <= 0) {
      player.health = Math.min(MAX_HEALTH, player.health + 1);
      player.regenTick = 1.5;
      player.exhaustion += 3;
    }
  }

  // ===== Досягнення довкілля (висота, плавання, біом) — throttle ~2.5 Гц =====
  achEnvTimer -= dt;
  if (achEnvTimer <= 0) {
    achEnvTimer = 0.4;
    if (player.pos.y < 6) unlockAch('deep');
    if (player.pos.y > 52) unlockAch('peak');
    if (player.prevInWater) unlockAch('swim');
    const b = biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z));
    unlockAch(b === BIOME.FOREST ? 'biome_forest'
      : b === BIOME.DESERT ? 'biome_desert'
      : b === BIOME.SNOWY ? 'biome_snowy' : 'biome_plains');
  }
}
let achEnvTimer = 0;

// Зʼїсти одну порцію сирого м'яса (клавіша F / кнопка 🍖)
function eatFood() {
  if (player.dead || player.eatTimer > 0) return;
  if (player.food <= 0 || player.hunger >= MAX_HUNGER) return;
  player.food -= 1;
  player.hunger = Math.min(MAX_HUNGER, player.hunger + EAT_AMOUNT);
  player.eatTimer = EAT_COOLDOWN;
  Sound.eat();
  unlockAch('eat');
  updateFoodHud();
}

// ============================================================
// Тварини
// ============================================================
const ANIMAL_MAX = 12;
const ANIMAL_DESPAWN_DIST = 80;
const animals = [];

function animalBox(parent, w, h, d, color, x, y, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.position.set(x, y, z);
  parent.add(mesh);
  return mesh;
}

// Нога з віссю обертання вгорі, щоб гойдалася при ходьбі
function animalLeg(parent, w, len, color, x, top, z) {
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(w, len, w),
    new THREE.MeshLambertMaterial({ color })
  );
  mesh.geometry.translate(0, -len / 2, 0);
  mesh.position.set(x, top, z);
  parent.add(mesh);
  return mesh;
}

// Моделі дивляться в -Z (як і гравець при yaw = 0)
const ANIMAL_TYPES = {
  pig: {
    speed: 1.4, halfW: 0.32, height: 0.95, hp: 10, food: 3,
    build(g) {
      const pink = 0xeba6a0, dark = 0xd98c86;
      animalBox(g, 0.6, 0.45, 0.9, pink, 0, 0.62, 0.05);
      animalBox(g, 0.42, 0.4, 0.32, pink, 0, 0.68, -0.55);
      animalBox(g, 0.2, 0.14, 0.08, dark, 0, 0.6, -0.74);   // п'ятачок
      return [
        animalLeg(g, 0.16, 0.4, dark, -0.18, 0.4, -0.25),
        animalLeg(g, 0.16, 0.4, dark, 0.18, 0.4, -0.25),
        animalLeg(g, 0.16, 0.4, dark, -0.18, 0.4, 0.32),
        animalLeg(g, 0.16, 0.4, dark, 0.18, 0.4, 0.32),
      ];
    },
  },
  cow: {
    speed: 1.1, halfW: 0.38, height: 1.3, hp: 10, food: 4,
    build(g) {
      const brown = 0x6b4a32, light = 0x8a6647, white = 0xe8e2d8;
      animalBox(g, 0.7, 0.55, 1.05, brown, 0, 0.95, 0.05);
      animalBox(g, 0.44, 0.42, 0.36, light, 0, 1.1, -0.68);
      animalBox(g, 0.3, 0.16, 0.06, white, 0, 0.98, -0.89);  // морда
      animalBox(g, 0.12, 0.12, 0.12, white, -0.3, 1.33, -0.6); // ріжки
      animalBox(g, 0.12, 0.12, 0.12, white, 0.3, 1.33, -0.6);
      return [
        animalLeg(g, 0.18, 0.68, brown, -0.22, 0.68, -0.32),
        animalLeg(g, 0.18, 0.68, brown, 0.22, 0.68, -0.32),
        animalLeg(g, 0.18, 0.68, brown, -0.22, 0.68, 0.4),
        animalLeg(g, 0.18, 0.68, brown, 0.22, 0.68, 0.4),
      ];
    },
  },
  chicken: {
    speed: 1.7, halfW: 0.2, height: 0.7, hp: 4, food: 2,
    build(g) {
      const white = 0xf2f0ea, orange = 0xe89c3f, red = 0xc63d33;
      animalBox(g, 0.36, 0.36, 0.5, white, 0, 0.42, 0.02);
      animalBox(g, 0.24, 0.3, 0.2, white, 0, 0.72, -0.22);
      animalBox(g, 0.1, 0.08, 0.1, orange, 0, 0.7, -0.36);   // дзьоб
      animalBox(g, 0.08, 0.1, 0.1, red, 0, 0.6, -0.32);      // борідка
      animalBox(g, 0.04, 0.3, 0.36, white, -0.2, 0.46, 0.04); // крила
      animalBox(g, 0.04, 0.3, 0.36, white, 0.2, 0.46, 0.04);
      return [
        animalLeg(g, 0.07, 0.24, orange, -0.09, 0.24, 0.02),
        animalLeg(g, 0.07, 0.24, orange, 0.09, 0.24, 0.02),
      ];
    },
  },
  sheep: {
    speed: 1.15, halfW: 0.36, height: 1.2, hp: 8, food: 3,
    build(g) {
      const wool = 0xe9e6df, skin = 0xd9c6ac, dark = 0x6b5a48;
      // Тіло-«шкіра» під вовною — видно після стрижки
      animalBox(g, 0.52, 0.42, 0.92, skin, 0, 0.82, 0.05);
      // Голова з темною мордою
      animalBox(g, 0.36, 0.36, 0.34, skin, 0, 1.06, -0.6);
      animalBox(g, 0.22, 0.14, 0.06, dark, 0, 0.98, -0.79);   // морда
      // Вовна — окремі меші, ховаються після стрижки й відростають із часом
      g.userData.woolMeshes = [
        animalBox(g, 0.74, 0.62, 1.08, wool, 0, 0.86, 0.05),  // руно на тулубі
        animalBox(g, 0.3, 0.2, 0.3, wool, 0, 1.3, -0.6),      // чубчик на голові
      ];
      return [
        animalLeg(g, 0.16, 0.5, dark, -0.19, 0.6, -0.28),
        animalLeg(g, 0.16, 0.5, dark, 0.19, 0.6, -0.28),
        animalLeg(g, 0.16, 0.5, dark, -0.19, 0.6, 0.34),
        animalLeg(g, 0.16, 0.5, dark, 0.19, 0.6, 0.34),
      ];
    },
  },
  wolf: {
    speed: 1.9, halfW: 0.3, height: 0.85, hp: 12, food: 0,
    build(g) {
      const fur = 0x9aa0a8, light = 0xc6cad1, dark = 0x5d6167, nose = 0x2b2b2b;
      animalBox(g, 0.44, 0.4, 0.8, fur, 0, 0.58, 0.1);          // тулуб
      animalBox(g, 0.36, 0.34, 0.32, light, 0, 0.72, -0.42);    // голова
      animalBox(g, 0.16, 0.14, 0.22, light, 0, 0.64, -0.62);    // морда
      animalBox(g, 0.1, 0.06, 0.06, nose, 0, 0.68, -0.74);      // ніс
      animalBox(g, 0.08, 0.14, 0.06, dark, -0.11, 0.94, -0.4);  // вуха
      animalBox(g, 0.08, 0.14, 0.06, dark, 0.11, 0.94, -0.4);
      // Хвіст із пивотом при основі — метляє, коли вовк приручений
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.1, 0.1, 0.42),
        new THREE.MeshLambertMaterial({ color: dark })
      );
      tail.geometry.translate(0, 0, 0.21);
      tail.position.set(0, 0.72, 0.48);
      tail.rotation.x = 0.55;
      g.add(tail);
      g.userData.tail = tail;
      // Червоний нашийник — з'являється після приручення
      const collar = new THREE.Mesh(
        new THREE.BoxGeometry(0.4, 0.1, 0.36),
        new THREE.MeshLambertMaterial({ color: 0xc63d33 })
      );
      collar.position.set(0, 0.7, -0.27);
      collar.visible = false;
      g.add(collar);
      g.userData.collar = collar;
      return [
        animalLeg(g, 0.12, 0.4, fur, -0.14, 0.4, -0.22),
        animalLeg(g, 0.12, 0.4, fur, 0.14, 0.4, -0.22),
        animalLeg(g, 0.12, 0.4, fur, -0.14, 0.4, 0.36),
        animalLeg(g, 0.12, 0.4, fur, 0.14, 0.4, 0.36),
      ];
    },
  },
  horse: {
    speed: 1.6, halfW: 0.42, height: 1.55, hp: 24, food: 0,
    build(g) {
      const coat = 0x8a5a33, dark = 0x4a3220, light = 0xb98a5a, leather = 0x7a3b2e;
      animalBox(g, 0.58, 0.6, 1.35, coat, 0, 1.05, 0.05);        // тулуб
      animalBox(g, 0.28, 0.6, 0.3, coat, 0, 1.5, -0.6);          // шия (нахилена вперед)
      animalBox(g, 0.26, 0.28, 0.6, coat, 0, 1.78, -0.82);       // голова
      animalBox(g, 0.2, 0.16, 0.14, light, 0, 1.72, -1.14);      // морда
      animalBox(g, 0.07, 0.16, 0.07, dark, -0.09, 1.98, -0.68);  // вуха
      animalBox(g, 0.07, 0.16, 0.07, dark, 0.09, 1.98, -0.68);
      animalBox(g, 0.12, 0.62, 0.16, dark, 0, 1.62, -0.44);      // грива вздовж шиї
      // Хвіст із пивотом при основі
      const tail = new THREE.Mesh(
        new THREE.BoxGeometry(0.12, 0.6, 0.12),
        new THREE.MeshLambertMaterial({ color: dark })
      );
      tail.geometry.translate(0, -0.3, 0);
      tail.position.set(0, 1.3, 0.74);
      tail.rotation.x = -0.35;
      g.add(tail);
      g.userData.tail = tail;
      // Сідло з попоною — з'являється після приручення
      const saddle = new THREE.Group();
      animalBox(saddle, 0.62, 0.06, 0.7, 0xa8433a, 0, 1.36, 0.0);   // попона
      animalBox(saddle, 0.4, 0.12, 0.44, leather, 0, 1.44, 0.0);    // сидіння
      animalBox(saddle, 0.66, 0.2, 0.1, dark, 0, 1.28, 0.0);        // підпруга
      saddle.visible = false;
      g.add(saddle);
      g.userData.saddle = saddle;
      return [
        animalLeg(g, 0.16, 0.78, coat, -0.19, 0.78, -0.42),
        animalLeg(g, 0.16, 0.78, coat, 0.19, 0.78, -0.42),
        animalLeg(g, 0.16, 0.78, dark, -0.19, 0.78, 0.5),
        animalLeg(g, 0.16, 0.78, dark, 0.19, 0.78, 0.5),
      ];
    },
  },
};

// Час відростання вовни після стрижки, с
const WOOL_REGROW_TIME = 60;

function spawnAnimal(type, x, y, z) {
  const def = ANIMAL_TYPES[type];
  const group = new THREE.Group();
  const legs = def.build(group);
  group.position.set(x, y, z);
  // Спершу yaw, потім локальний нахил (для пози сидіння вовка)
  group.rotation.order = 'YXZ';
  scene.add(group);
  const mats = [];
  group.traverse((o) => { if (o.isMesh) mats.push(o.material); });
  animals.push({
    type, group, legs, mats,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2,
    targetYaw: 0,
    halfW: def.halfW,
    height: def.height,
    speed: def.speed,
    state: 'idle',
    stateTimer: Math.random() * 2,
    legPhase: 0,
    onGround: false,
    health: def.hp,
    foodValue: def.food,
    hurt: 0,       // спалах при ударі (0..1)
    panic: 0,      // тікає від гравця після удару
    // Вовна (лише вівці): меші руна, стан «нестрижена», таймер відростання
    woolMeshes: group.userData.woolMeshes || null,
    wool: !!group.userData.woolMeshes,
    woolTimer: 0,
    // Вовк: приручення (нашийник + хвіст), сидіння, бій і швидкість бігу
    maxHealth: def.hp,
    tamed: false,
    sitting: false,
    fedCount: 0,
    attackCD: 0,
    runBoost: 1,
    wagPhase: Math.random() * Math.PI * 2,
    tail: group.userData.tail || null,
    collar: group.userData.collar || null,
    // Кінь: сідло (видиме після приручення)
    saddle: group.userData.saddle || null,
  });
}

function trySpawnAnimal() {
  if (animals.length >= ANIMAL_MAX) return;
  const angle = Math.random() * Math.PI * 2;
  const dist = 16 + Math.random() * 28;
  const x = Math.floor(player.pos.x + Math.cos(angle) * dist);
  const z = Math.floor(player.pos.z + Math.sin(angle) * dist);
  const h = heightAt(x, z);
  if (h <= SEA + 1) return;                    // не у воді й не на пляжі
  const surf = blockAt(x, h, z);
  const biome = biomeAt(x, z);
  // Свійські тварини пасуться на траві; вовки водяться в лісі й тундрі
  // (у тундрі — єдина тварина, бо інші не з'являються на снігу)
  if (surf !== GRASS && !(surf === SNOW && biome === BIOME.SNOWY)) return;
  if (isSolid(blockAt(x, h + 1, z))) return;   // місце вільне
  let type;
  if (surf === SNOW) {
    type = 'wolf';
  } else if ((biome === BIOME.FOREST || biome === BIOME.SNOWY) && Math.random() < 0.3) {
    type = 'wolf';
  } else if (biome === BIOME.PLAINS && Math.random() < 0.22) {
    type = 'horse';   // коні пасуться на відкритих рівнинах
  } else {
    const types = Object.keys(ANIMAL_TYPES).filter((t) => t !== 'wolf' && t !== 'horse');
    type = types[Math.floor(Math.random() * types.length)];
  }
  spawnAnimal(type, x + 0.5, h + 1.01, z + 0.5);
}

function removeAnimal(index) {
  const a = animals[index];
  if (ridingHorse === a) dismountHorse(false);   // кінь зник під вершником
  scene.remove(a.group);
  a.group.traverse((obj) => {
    if (obj.isMesh) {
      obj.geometry.dispose();
      obj.material.dispose();
    }
  });
  animals.splice(index, 1);
}

function updateAnimal(a, dt) {
  // Лава палить тварин так само, як істот; смерть обробляється в updateAnimals
  if (isLavaId(blockAt(Math.floor(a.pos.x), Math.floor(a.pos.y + 0.3), Math.floor(a.pos.z)))) {
    a.health -= dt * 7;
    if (Math.random() < dt * 24) {
      spawnParticles(a.pos.x, a.pos.y + a.height * 0.6, a.pos.z, LAVA_FIRE_COLOR, 1,
        { radius: 0.25, speed: 0.6, upBias: 1.3, life: 0.5, size: 0.12, gravity: -6 });
    }
  }

  // Паніка після удару: тікає геть від гравця прискорено
  // (приручений вовк не панікує — його веде updateTamedWolf)
  const panicking = !a.tamed && a.panic > 0;
  if (a.tamed) {
    // Вовк-компаньйон іде за гравцем і охороняє; приручений кінь пасеться
    // на місці й чекає вершника (не блукає геть, поки гравець зайнятий)
    if (a.type === 'wolf') updateTamedWolf(a, dt);
    else a.state = 'idle';
  } else if (panicking) {
    a.panic -= dt;
    // Дивиться геть від гравця: «до гравця» — atan2(a−p); напрям утечі — протилежний
    a.targetYaw = Math.atan2(player.pos.x - a.pos.x, player.pos.z - a.pos.z);
  } else {
    // Зміна стану: блукає / стоїть
    a.stateTimer -= dt;
    if (a.stateTimer <= 0) {
      if (a.state === 'walk') {
        a.state = 'idle';
        a.stateTimer = 1 + Math.random() * 3;
      } else {
        a.state = 'walk';
        a.stateTimer = 2 + Math.random() * 4;
        a.targetYaw = Math.random() * Math.PI * 2;
      }
    }
  }

  // Плавний поворот до цільового напрямку (швидше в паніці й у вовка-компаньйона)
  let dyaw = a.targetYaw - a.yaw;
  dyaw = ((dyaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  a.yaw += dyaw * Math.min(1, dt * (panicking || a.tamed ? 8 : 3));

  const moving = panicking || a.state === 'walk';
  const sp = moving ? a.speed * (panicking ? 2.2 : a.tamed ? a.runBoost : 1) : 0;
  a.vel.x = -Math.sin(a.yaw) * sp;
  a.vel.z = -Math.cos(a.yaw) * sp;

  const inWater = isWaterId(blockAt(
    Math.floor(a.pos.x), Math.floor(a.pos.y + 0.3), Math.floor(a.pos.z)
  ));
  if (inWater) {
    a.vel.y = Math.min(a.vel.y + 40 * dt, 3); // спливає на поверхню
  } else {
    a.vel.y -= 24 * dt;
  }

  a.onGround = false;
  moveEntityAxis(a, 'y', a.vel.y * dt);
  const bumpedX = moveEntityAxis(a, 'x', a.vel.x * dt);
  const bumpedZ = moveEntityAxis(a, 'z', a.vel.z * dt);
  if ((bumpedX || bumpedZ) && a.onGround && moving) a.vel.y = 7; // перестрибнути блок

  // Анімація ніг (сидячий вовк підбирає задні лапи, передні тримає прямо)
  if (a.tamed && a.sitting) {
    a.legs.forEach((leg, i) => { leg.rotation.x = i < 2 ? -0.3 : 1.25; });
  } else {
    if (moving && (a.onGround || inWater)) {
      a.legPhase += dt * 9;
    }
    const swing = Math.sin(a.legPhase) * 0.55 * (moving ? 1 : 0);
    a.legs.forEach((leg, i) => {
      leg.rotation.x = i % 2 === 0 ? swing : -swing;
    });
  }

  // Хвіст вовка: приручений радісно метляє (швидше поряд із гравцем), дикий — ледь
  if (a.tail) {
    a.wagPhase += dt * (a.tamed ? (a.state === 'idle' ? 7 : 11) : 2);
    a.tail.rotation.y = Math.sin(a.wagPhase) * (a.tamed ? 0.55 : 0.12);
  }

  // Червоний спалах при отриманні удару
  if (a.hurt > 0) {
    a.hurt = Math.max(0, a.hurt - dt * 3);
    for (const mat of a.mats) mat.emissive.setRGB(a.hurt * 0.6, 0, 0);
  }

  // Вовна відростає з часом (вівця «наїдає» руно, пасучись)
  if (a.woolMeshes && !a.wool) {
    a.woolTimer -= dt;
    if (a.woolTimer <= 0) {
      a.wool = true;
      for (const m of a.woolMeshes) m.visible = true;
    }
  }

  a.group.position.copy(a.pos);
  a.group.rotation.y = a.yaw;
  // Поза сидіння: легкий нахил корпуса назад (ніс догори, зад до землі)
  a.group.rotation.x = a.tamed && a.sitting ? 0.26 : 0;
}

let animalSpawnTimer = 0;

function updateAnimals(dt) {
  animalSpawnTimer -= dt;
  if (animalSpawnTimer <= 0) {
    trySpawnAnimal();
    animalSpawnTimer = 2;
  }
  for (let i = animals.length - 1; i >= 0; i--) {
    const a = animals[i];
    // Приручений вовк ніколи не деспавниться; випавши за межі світу —
    // повертається до гравця (замість зникнути)
    if (a.tamed && a.pos.y < -10) {
      wolfWarpToPlayer(a);
      updateAnimal(a, dt);
      continue;
    }
    if (!a.tamed && (a.pos.distanceTo(player.pos) > ANIMAL_DESPAWN_DIST || a.pos.y < -10)) {
      removeAnimal(i);
    } else {
      // Кінь під вершником: фізику й анімацію веде driveHorse (з updatePlayer),
      // але загибель (наприклад, у лаві) обробляємо тут, як для всіх тварин
      if (a !== ridingHorse) updateAnimal(a, dt);
      // Загибель (наприклад, у лаві) — димок і зникнення, без м'яса
      if (a.health <= 0) {
        spawnParticles(a.pos.x, a.pos.y + a.height * 0.5, a.pos.z, SMOKE_COLOR, 10,
          { radius: 0.35, speed: 1.6, upBias: 1.2, life: 0.7, size: 0.13, gravity: -3 });
        Sound.mobDeath();
        removeAnimal(i);
      }
    }
  }
}

// ============================================================
// Вовк-компаньйон: приручення м'ясом, слідування за гравцем і охорона
// ============================================================
// Дикі вовки водяться в лісі й тундрі та блукають, як інші тварини.
// ПКМ по вовку з м'ясом у торбі (🍖) годує його: кожна порція — шанс
// приручити (третя — напевно). Приручений вовк (червоний нашийник) іде за
// гравцем, телепортується, якщо загубився, і кидається на нічну нечисть
// поряд. ПКМ по прирученому — сидіти/йти; годування лікує його.
const WOLF_FOLLOW_MIN = 3.2;    // ближче — стоїть і метляє хвостом
const WOLF_RUN_DIST = 8;        // далі — доганяє бігом
const WOLF_WARP_DIST = 24;      // далі — телепортується до гравця
const WOLF_GUARD_R = 10;        // радіус пошуку нечисті біля гравця/вовка
const WOLF_ATTACK_REACH = 1.4;  // дистанція укусу
const WOLF_ATTACK_CD = 0.9;     // перезарядка укусу, с
const WOLF_DMG = 4;             // шкода від укусу
const WOLF_TAME_CHANCE = 0.4;   // шанс приручення з однієї порції
const WOLF_HEAL_PER_FEED = 5;   // скільки здоров'я лікує порція прирученому
const HEART_COLOR = new THREE.Color(0xe8577a);

// Телепорт вовка до гравця (загубився, застряг чи випав за межі світу):
// шукаємо вільну клітинку з твердою опорою поряд із гравцем.
function wolfWarpToPlayer(a) {
  const px = Math.floor(player.pos.x), py = Math.floor(player.pos.y), pz = Math.floor(player.pos.z);
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1], [0, 0]]) {
    const x = px + dx, z = pz + dz;
    for (let y = Math.min(HEIGHT - 2, py + 2); y > Math.max(1, py - 6); y--) {
      if (isSolid(blockAt(x, y - 1, z)) && !isSolid(blockAt(x, y, z)) && !isSolid(blockAt(x, y + 1, z))) {
        a.pos.set(x + 0.5, y + 0.01, z + 0.5);
        a.vel.set(0, 0, 0);
        return true;
      }
    }
  }
  // Крайній випадок: просто до гравця (колізії відштовхнуть)
  a.pos.set(player.pos.x, player.pos.y + 0.1, player.pos.z);
  a.vel.set(0, 0, 0);
  return true;
}

// ШІ прирученого вовка: задає стан/курс/швидкість перед спільною фізикою
// в updateAnimal. Пріоритети: сидить → бій із нечистю → слідування.
function updateTamedWolf(a, dt) {
  a.attackCD = Math.max(0, a.attackCD - dt);
  a.runBoost = 1;
  if (a.sitting) {
    a.state = 'idle';
    return;
  }

  // Охорона: найближчий ворог поблизу гравця чи самого вовка
  let target = null, bestDist = Infinity;
  for (const m of mobs) {
    const d = Math.min(m.pos.distanceTo(player.pos), m.pos.distanceTo(a.pos));
    if (d < WOLF_GUARD_R && d < bestDist) { bestDist = d; target = m; }
  }
  if (target) {
    const dx = target.pos.x - a.pos.x, dz = target.pos.z - a.pos.z;
    const dist = Math.hypot(dx, dz);
    a.targetYaw = Math.atan2(-dx, -dz);          // модель дивиться в -Z
    if (dist > WOLF_ATTACK_REACH) {
      a.state = 'walk';
      a.runBoost = 1.9;                          // кидається на ворога бігом
    } else {
      a.state = 'idle';
      if (a.attackCD <= 0) {
        a.attackCD = WOLF_ATTACK_CD;
        if (a.onGround) a.vel.y = 3.5;           // випад-стрибок при укусі
        damageEntity(target, false, WOLF_DMG, dx, dz, 2.5);
        Sound.bark();
      }
    }
    return;
  }

  // Немає ворогів — слідувати за гравцем
  const dx = player.pos.x - a.pos.x, dz = player.pos.z - a.pos.z;
  const dist = Math.hypot(dx, dz);
  if (dist > WOLF_WARP_DIST) {
    wolfWarpToPlayer(a);
    return;
  }
  a.targetYaw = Math.atan2(-dx, -dz);            // дивиться на гравця
  if (dist > WOLF_FOLLOW_MIN) {
    a.state = 'walk';
    a.runBoost = dist > WOLF_RUN_DIST ? 1.8 : 1;
  } else {
    a.state = 'idle';
  }
}

function nearestWolf(maxDist = Infinity) {
  let best = null, bestDist = maxDist;
  for (const a of animals) {
    if (a.type !== 'wolf') continue;
    const d = a.pos.distanceTo(player.pos);
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return best;
}

// Погодувати вовка порцією м'яса з торби їжі (🍖). Дикому — шанс приручення
// (сердечка; третя порція приручує напевно), прирученому — лікування.
// Повертає true, якщо порцію витрачено.
function feedWolfEntity(w) {
  if (player.food <= 0) return false;
  if (w.tamed && w.health >= w.maxHealth) return false;   // ситий і здоровий
  player.food--;
  updateFoodHud();
  w.panic = 0;
  spawnParticles(w.pos.x, w.pos.y + w.height * 0.9, w.pos.z, HEART_COLOR, 7,
    { radius: 0.35, speed: 1.2, upBias: 1.6, life: 0.8, size: 0.12, gravity: -2 });
  if (w.tamed) {
    w.health = Math.min(w.maxHealth, w.health + WOLF_HEAL_PER_FEED);
    Sound.whine();
    return true;
  }
  w.fedCount++;
  if (w.fedCount >= 3 || Math.random() < WOLF_TAME_CHANCE) {
    w.tamed = true;
    w.sitting = false;
    if (w.collar) w.collar.visible = true;
    Sound.bark();
    sleepToast('🐺 Вовк приручений — тепер він твій друг!');
    unlockAch('tame');
    saveGame();
  } else {
    Sound.whine();
  }
  return true;
}

// Тварина заданого типу в прицілі поблизу (для ПКМ-взаємодії) — той самий
// конус, що й удар. Спільне для вовка (годування) і коня (сідлання).
const _wolfDir = new THREE.Vector3();
function animalInSight(type, reach = 3.2) {
  camera.getWorldDirection(_wolfDir);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let best = null, bestDist = Infinity;
  for (const a of animals) {
    if (a.type !== type) continue;
    const tx = a.pos.x - ox;
    const ty = a.pos.y + a.height * 0.5 - oy;
    const tz = a.pos.z - oz;
    const dist = Math.hypot(tx, ty, tz);
    if (dist > reach) continue;
    const dot = (tx * _wolfDir.x + ty * _wolfDir.y + tz * _wolfDir.z) / (dist || 1);
    if (dot < 0.55) continue;
    if (dist < bestDist) { bestDist = dist; best = a; }
  }
  return best;
}

// ПКМ по вовку: дикого чи пораненого годуємо (якщо є м'ясо), здоровому
// прирученому — команда «сидіти/йти». Повертає true, якщо клік оброблено.
function tryInteractWolf() {
  const w = animalInSight('wolf');
  if (!w) return false;
  if (feedWolfEntity(w)) return true;
  if (w.tamed) {
    w.sitting = !w.sitting;
    Sound.whine();
    return true;
  }
  return false;
}

// Відновлення приручених вовків зі збереження (формат [x, y, z, health, sitting])
if (savedGame && Array.isArray(savedGame.wolves)) {
  for (const e of savedGame.wolves) {
    if (!Array.isArray(e) || e.length < 3) continue;
    spawnAnimal('wolf', e[0], e[1], e[2]);
    const w = animals[animals.length - 1];
    w.tamed = true;
    if (w.collar) w.collar.visible = true;
    if (Number.isFinite(e[3])) w.health = Math.max(1, Math.min(w.maxHealth, e[3]));
    w.sitting = e[4] === 1;
  }
}

// ============================================================
// Кінь: приручення їжею і їзда верхи — швидка подорож суходолом
// ============================================================
// Дикі коні пасуться на рівнинах. ПКМ з їжею в торбі (🍖) годує коня: кожна
// порція — шанс приручити (третя — напевно). На прирученому з'являється сідло;
// ПКМ по ньому — сісти верхи. Верхи кермуємо поглядом (W — уперед, S — назад),
// кінь галопує швидше за біг, сам перестрибує блок заввишки; Space — злізти.
const HORSE_TAME_CHANCE = 0.4;   // шанс приручення з однієї порції
const HORSE_HEAL_PER_FEED = 6;   // скільки здоров'я лікує порція прирученому
const HORSE_SEAT = 1.05;         // висота «сідла» над ногами коня (для вершника)
const HORSE_MAXV = 9.5;          // макс. швидкість галопу (швидше за біг гравця)
const HORSE_ACCEL = 40;          // прискорення розгону (з опором виходить на макс.)
const HORSE_DRAG = 3.5;          // згасання швидкості без острогів
const HORSE_JUMP = 8.5;          // вертикальний імпульс автострибка через блок
let ridingHorse = null;          // кінь, на якому зараз їде гравець (або null)

function nearestHorse(maxDist = Infinity) {
  let best = null, bestDist = maxDist;
  for (const a of animals) {
    if (a.type !== 'horse') continue;
    const d = a.pos.distanceTo(player.pos);
    if (d < bestDist) { bestDist = d; best = a; }
  }
  return best;
}

// Погодувати коня порцією їжі з торби (🍖). Дикому — шанс приручення
// (сердечка; третя порція приручує напевно), прирученому — лікування.
// Повертає true, якщо порцію витрачено.
function feedHorseEntity(h) {
  if (player.food <= 0) return false;
  if (h.tamed && h.health >= h.maxHealth) return false;   // ситий і здоровий
  player.food--;
  updateFoodHud();
  h.panic = 0;
  spawnParticles(h.pos.x, h.pos.y + h.height * 0.9, h.pos.z, HEART_COLOR, 7,
    { radius: 0.4, speed: 1.2, upBias: 1.6, life: 0.8, size: 0.12, gravity: -2 });
  if (h.tamed) {
    h.health = Math.min(h.maxHealth, h.health + HORSE_HEAL_PER_FEED);
    Sound.whine();
    return true;
  }
  h.fedCount++;
  if (h.fedCount >= 3 || Math.random() < HORSE_TAME_CHANCE) {
    h.tamed = true;
    if (h.saddle) h.saddle.visible = true;
    Sound.neigh();
    sleepToast('🐴 Кінь приручений — ПКМ по ньому, щоб сісти верхи!');
    saveGame();
  } else {
    Sound.whine();
  }
  return true;
}

function mountHorse(h) {
  if (!h || !h.tamed || ridingHorse || ridingBoat) return false;
  ridingHorse = h;
  h.vel.set(0, 0, 0);
  h.state = 'idle';
  mining = false;
  cancelBowDraw();
  player.vel.set(0, 0, 0);
  player.flying = false;
  unlockAch('rider');
  Sound.neigh();
  return true;
}

function dismountHorse(reposition = true) {
  if (!ridingHorse) return;
  const h = ridingHorse;
  ridingHorse = null;
  h.vel.x = 0; h.vel.z = 0;
  h.state = 'idle';
  if (reposition) {
    player.pos.set(h.pos.x, h.pos.y + 0.6, h.pos.z);   // зіскочити біля коня
    player.vel.set(0, 0, 0);
    player.fallPeakY = player.pos.y;
    player.prevOnGround = false;
  }
}

// ПКМ по коню: дикого чи пораненого годуємо (якщо є їжа), на здорового
// прирученого сідаємо верхи. Повертає true, якщо клік оброблено.
function tryInteractHorse() {
  if (ridingHorse) return false;
  const h = animalInSight('horse');
  if (!h) return false;
  if (!h.tamed) return feedHorseEntity(h);
  if (h.health < h.maxHealth && feedHorseEntity(h)) return true;
  return mountHorse(h);
}

// Їзда верхи: фізика коня під вершником (викликається з updatePlayer замість
// фізики гравця). Кермо — погляд гравця; кінь сам перестрибує блок заввишки.
function driveHorse(dt) {
  const h = ridingHorse;
  h.yaw = h.targetYaw = player.yaw;             // кінь повертається за поглядом

  let thrust = 0;
  if (keys['KeyW']) thrust += 1;
  if (keys['KeyS']) thrust -= 0.5;
  if (joy.active) thrust += -joy.y;             // сенсор: уперед по джойстику
  thrust = THREE.MathUtils.clamp(thrust, -0.5, 1);

  const inWater = isWaterId(blockAt(
    Math.floor(h.pos.x), Math.floor(h.pos.y + 0.3), Math.floor(h.pos.z)
  ));
  // У воді кінь бреде повільно (перепливає, але це не човен)
  const fwdx = -Math.sin(h.yaw), fwdz = -Math.cos(h.yaw);
  const accel = inWater ? HORSE_ACCEL * 0.4 : HORSE_ACCEL;
  h.vel.x += fwdx * thrust * accel * dt;
  h.vel.z += fwdz * thrust * accel * dt;
  const drag = Math.max(0, 1 - HORSE_DRAG * dt);
  h.vel.x *= drag;
  h.vel.z *= drag;
  const maxv = inWater ? HORSE_MAXV * 0.4 : HORSE_MAXV;
  const sp = Math.hypot(h.vel.x, h.vel.z);
  if (sp > maxv) { h.vel.x *= maxv / sp; h.vel.z *= maxv / sp; }

  if (inWater) h.vel.y = Math.min(h.vel.y + 40 * dt, 3);   // спливає
  else h.vel.y -= 24 * dt;

  h.onGround = false;
  moveEntityAxis(h, 'y', h.vel.y * dt);
  const bumpedX = moveEntityAxis(h, 'x', h.vel.x * dt);
  const bumpedZ = moveEntityAxis(h, 'z', h.vel.z * dt);
  // Автострибок через блок — лише на ходу, щоб не підстрибувати біля стіни
  if ((bumpedX || bumpedZ) && h.onGround && sp > 1) h.vel.y = HORSE_JUMP;

  // Лава палить коня і під вершником (як updateAnimal для вільних тварин)
  if (isLavaId(blockAt(Math.floor(h.pos.x), Math.floor(h.pos.y + 0.3), Math.floor(h.pos.z)))) {
    h.health -= dt * 7;
  }

  // Ноги в такт галопу; спалах при пораненні згасає, як у вільних тварин
  if (h.onGround || inWater) h.legPhase += dt * (3 + sp * 1.6);
  const swing = Math.sin(h.legPhase) * 0.6 * Math.min(1, sp / 3);
  h.legs.forEach((leg, i) => { leg.rotation.x = i % 2 === 0 ? swing : -swing; });
  if (h.hurt > 0) {
    h.hurt = Math.max(0, h.hurt - dt * 3);
    for (const mat of h.mats) mat.emissive.setRGB(h.hurt * 0.6, 0, 0);
  }

  h.group.position.copy(h.pos);
  h.group.rotation.y = h.yaw;
  h.group.rotation.x = 0;

  // Вершник у сідлі: без власної фізики й шкоди від падіння
  player.pos.set(h.pos.x, h.pos.y + HORSE_SEAT, h.pos.z);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.fallPeakY = player.pos.y;

  // Провалилися під світ (баг рельєфу) — злізти, щоб не застрягти
  if (h.pos.y < -8) dismountHorse(false);
}

// Відновлення приручених коней зі збереження (формат [x, y, z, health])
if (savedGame && Array.isArray(savedGame.horses)) {
  for (const e of savedGame.horses) {
    if (!Array.isArray(e) || e.length < 3) continue;
    spawnAnimal('horse', e[0], e[1], e[2]);
    const h = animals[animals.length - 1];
    h.tamed = true;
    if (h.saddle) h.saddle.visible = true;
    if (Number.isFinite(e[3])) h.health = Math.max(1, Math.min(h.maxHealth, e[3]));
  }
}

// ============================================================
// Вороги (з'являються вночі): зомбі б'ють упритул, кріпери підриваються,
// скелети тримають дистанцію й стріляють з лука
// ============================================================
const MOB_MAX = 6;
const MOB_DESPAWN_DIST = 80;
let dayNightSun = 1; // оновлюється в updateDayNight: 1 — полудень, -1 — північ

const ZOMBIE_COLOR = new THREE.Color(0x4f7a44);
const CREEPER_COLOR = new THREE.Color(0x5fa64d);
const SKELETON_COLOR = new THREE.Color(0xd8d6cc);
const SMOKE_COLOR = new THREE.Color(0x4a4a4a);
const LAVA_FIRE_COLOR = new THREE.Color(0xff7a1a);
const mobs = [];

// Будує модель кріпера: чотириногий зелений силует із характерним «обличчям».
// Дивиться в -Z (як гравець при yaw = 0). Повертає пари ніг для анімації.
function buildCreeper(g) {
  const body = 0x5fa64d, dark = 0x3f7a35, face = 0x102008;
  animalBox(g, 0.5, 0.78, 0.28, body, 0, 1.18, 0);          // тулуб
  animalBox(g, 0.5, 0.5, 0.5, body, 0, 1.82, 0);            // голова
  animalBox(g, 0.13, 0.13, 0.03, face, -0.12, 1.9, -0.255); // очі
  animalBox(g, 0.13, 0.13, 0.03, face, 0.12, 1.9, -0.255);
  animalBox(g, 0.1, 0.22, 0.03, face, 0, 1.74, -0.255);     // «ніс/рот»
  // Чотири короткі лапи, пивот угорі (як у тварин)
  const fl = animalLeg(g, 0.17, 0.42, dark, -0.15, 0.78, -0.18);
  const fr = animalLeg(g, 0.17, 0.42, dark, 0.15, 0.78, -0.18);
  const bl = animalLeg(g, 0.17, 0.42, dark, -0.15, 0.78, 0.18);
  const br = animalLeg(g, 0.17, 0.42, dark, 0.15, 0.78, 0.18);
  return { legs: [fl, fr, bl, br] };
}

// Будує гуманоїдну модель зомбі; повертає кінцівки для анімації.
// Модель дивиться в -Z (як гравець при yaw = 0).
function buildZombie(g) {
  const skin = 0x5b8a4a, shirt = 0x2f5a6b, pants = 0x33335a, eye = 0x10160f;
  animalBox(g, 0.52, 0.7, 0.3, shirt, 0, 1.15, 0);          // тулуб
  animalBox(g, 0.46, 0.46, 0.46, skin, 0, 1.73, 0);         // голова
  animalBox(g, 0.1, 0.08, 0.03, eye, -0.11, 1.76, -0.235);  // очі
  animalBox(g, 0.1, 0.08, 0.03, eye, 0.11, 1.76, -0.235);
  // Руки — пивот біля плеча (animalLeg переносить геометрію на -len/2 по Y),
  // у updateMob їх повертають уперед у класичній позі зомбі.
  const armL = animalLeg(g, 0.17, 0.62, skin, -0.345, 1.46, 0);
  const armR = animalLeg(g, 0.17, 0.62, skin, 0.345, 1.46, 0);
  const legL = animalLeg(g, 0.19, 0.8, pants, -0.13, 0.8, 0);
  const legR = animalLeg(g, 0.19, 0.8, pants, 0.13, 0.8, 0);
  return { legs: [legL, legR], arms: [armL, armR] };
}

// Будує кістлявого скелета, що тримає лук у правій руці; повертає кінцівки.
// Модель дивиться в -Z (як гравець при yaw = 0). Лук закріплено на правій руці,
// тож під час пострілу (рука піднімається) дуга наводиться на ціль.
function buildSkeleton(g) {
  const bone = 0xd8d6cc, dark = 0x171712, bowCol = 0x8a5a2b;
  animalBox(g, 0.34, 0.66, 0.2, bone, 0, 1.16, 0);          // тулуб (вузький)
  animalBox(g, 0.42, 0.42, 0.42, bone, 0, 1.72, 0);         // голова-череп
  animalBox(g, 0.12, 0.1, 0.03, dark, -0.1, 1.74, -0.215);  // очні западини
  animalBox(g, 0.12, 0.1, 0.03, dark, 0.1, 1.74, -0.215);
  // Тонкі кінцівки; руки витягнуті вперед, права тримає лук
  const armL = animalLeg(g, 0.12, 0.6, bone, -0.27, 1.44, 0);
  const armR = animalLeg(g, 0.12, 0.6, bone, 0.27, 1.44, 0);
  const legL = animalLeg(g, 0.13, 0.78, bone, -0.1, 0.78, 0);
  const legR = animalLeg(g, 0.13, 0.78, bone, 0.1, 0.78, 0);
  // Лук кріпиться до правої руки (пивот руки вгорі — лук опускаємо до «кисті»)
  const bowG = new THREE.Group();
  const limb = new THREE.Mesh(
    new THREE.TorusGeometry(0.26, 0.025, 5, 12, Math.PI * 1.25),
    new THREE.MeshLambertMaterial({ color: bowCol })
  );
  limb.rotation.z = Math.PI / 2;                             // дуга у вертикалі
  bowG.add(limb);
  const string = new THREE.Mesh(
    new THREE.CylinderGeometry(0.006, 0.006, 0.46, 4),
    new THREE.MeshLambertMaterial({ color: 0xe8e8e8 })
  );
  string.position.z = 0.13;
  bowG.add(string);
  bowG.position.set(0, -0.5, -0.16);                         // біля кисті, попереду
  armR.add(bowG);
  return { legs: [legL, legR], arms: [armL, armR] };
}

function spawnMob(x, y, z, type = 'zombie') {
  const group = new THREE.Group();
  const isCreeper = type === 'creeper';
  const isSkeleton = type === 'skeleton';
  const built = isCreeper ? buildCreeper(group)
    : isSkeleton ? buildSkeleton(group) : buildZombie(group);
  group.position.set(x, y, z);
  scene.add(group);
  const mats = [];
  group.traverse((o) => { if (o.isMesh) mats.push(o.material); });
  mobs.push({
    group, type, legs: built.legs, arms: built.arms || null, mats,
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    yaw: Math.random() * Math.PI * 2,
    targetYaw: 0,
    halfW: isCreeper ? 0.28 : 0.3,
    height: isCreeper ? 2.1 : 1.9,
    speed: isCreeper ? 2.6 : isSkeleton ? 2.0 : 2.2,
    onGround: false,
    legPhase: 0,
    health: isCreeper ? 10 : isSkeleton ? 12 : 14,
    hurt: 0,        // спалах при ударі (0..1)
    attackCD: 0,    // перезарядка атаки
    attackAnim: 0,  // мах руками при ударі
    burn: 0,        // час горіння під сонцем
    fuse: 0,        // кріпер: час, що лишився до вибуху (0 — ґніт не горить)
    detonated: false,
    shootCD: 1 + Math.random(),  // скелет: перезарядка пострілу з лука
    aimAnim: 0,                  // скелет: підняття рук під час прицілювання (0..1)
  });
}

let mobSpawnTimer = 4;

function trySpawnMob() {
  if (mobs.length >= MOB_MAX) return;
  if (dayNightSun > -0.05) return;             // тільки в темряві
  const angle = Math.random() * Math.PI * 2;
  const dist = 14 + Math.random() * 16;
  const x = Math.floor(player.pos.x + Math.cos(angle) * dist);
  const z = Math.floor(player.pos.z + Math.sin(angle) * dist);
  const h = heightAt(x, z);
  if (h <= SEA + 1) return;                     // не у воді й не на пляжі
  if (!isSolid(blockAt(x, h, z))) return;       // тверда опора
  if (isSolid(blockAt(x, h + 1, z)) || isSolid(blockAt(x, h + 2, z))) return; // є місце
  if (torchNear(x + 0.5, h + 1, z + 0.5, 7)) return; // світло смолоскипа відлякує нечисть
  // Нічна нечисть: ~чверть кріпери (підривники), ~чверть скелети (лучники), решта зомбі
  const r = Math.random();
  const type = r < 0.25 ? 'creeper' : r < 0.5 ? 'skeleton' : 'zombie';
  spawnMob(x + 0.5, h + 1.01, z + 0.5, type);
}

function removeMob(index) {
  const m = mobs[index];
  scene.remove(m.group);
  m.group.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
  });
  mobs.splice(index, 1);
}

// Кріпер: дистанції запалу/розрядки ґноту та тривалість самого ґноту
const CREEPER_IGNITE_DIST = 2.7;
const CREEPER_DEFUSE_DIST = 4.2;
const CREEPER_FUSE_TIME = 1.4;

// Скелет: межі кайтингу (відступ/наближення), дальність і перезарядка пострілу
const SKEL_NEAR = 4.5;          // ближче — відступає
const SKEL_FAR = 11;            // далі — наближається
const SKEL_SHOOT_RANGE = 16;    // максимальна дальність пострілу
const SKEL_SHOOT_CD = 1.8;      // секунд між пострілами (+ розкид)

// Груба перевірка лінії зору від голови моба до грудей гравця:
// семплимо відрізок і шукаємо тверді блоки на шляху.
function mobCanSeePlayer(m) {
  const ox = m.pos.x, oy = m.pos.y + 1.7, oz = m.pos.z;
  const tx = player.pos.x, ty = player.pos.y + player.height * 0.5, tz = player.pos.z;
  const dist = Math.hypot(tx - ox, ty - oy, tz - oz);
  const steps = Math.ceil(dist / 0.7);
  for (let s = 1; s < steps; s++) {
    const t = s / steps;
    const bx = Math.floor(ox + (tx - ox) * t);
    const by = Math.floor(oy + (ty - oy) * t);
    const bz = Math.floor(oz + (tz - oz) * t);
    if (isSolid(blockAt(bx, by, bz))) return false;
  }
  return true;
}

function updateMob(m, dt) {
  const isCreeper = m.type === 'creeper';
  const isSkeleton = m.type === 'skeleton';

  // Лава палить будь-яку істоту (навіть кріпера) — швидка шкода й полум'я
  if (isLavaId(blockAt(Math.floor(m.pos.x), Math.floor(m.pos.y + 0.3), Math.floor(m.pos.z)))) {
    m.health -= dt * 7;
    if (Math.random() < dt * 24) {
      spawnParticles(m.pos.x, m.pos.y + 0.8, m.pos.z, LAVA_FIRE_COLOR, 1,
        { radius: 0.25, speed: 0.6, upBias: 1.3, life: 0.5, size: 0.13, gravity: -6 });
    }
    if (m.health <= 0) return;
  }

  // Удень зомбі та скелети займаються вогнем і швидко гинуть; кріпери — ні
  if (!isCreeper && dayNightSun > 0.15) {
    m.burn += dt;
    if (Math.random() < dt * 7) {
      spawnParticles(m.pos.x, m.pos.y + 1.1, m.pos.z, SMOKE_COLOR, 1,
        { radius: 0.3, speed: 0.5, upBias: 0.9, life: 0.7, size: 0.12, gravity: -3 });
    }
    if (m.burn > 2.2) { m.health = 0; return; }
  } else {
    m.burn = 0;
  }

  // Переслідування гравця
  const dx = player.pos.x - m.pos.x;
  const dz = player.pos.z - m.pos.z;
  const distH = Math.hypot(dx, dz);
  const chase = distH < 26 && !player.dead;
  if (chase) m.targetYaw = Math.atan2(-dx, -dz); // дивиться в -Z

  let dyaw = m.targetYaw - m.yaw;
  dyaw = ((dyaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  m.yaw += dyaw * Math.min(1, dt * 6);

  // Кріпер: запалює ґніт зблизька, завмирає й набрякає, потім вибухає.
  // Якщо гравець відбіг — ґніт гасне, кріпер знову переслідує.
  if (isCreeper && !player.dead) {
    if (m.fuse > 0) {
      if (distH > CREEPER_DEFUSE_DIST) {
        m.fuse = 0;                                 // розрядка: гравець утік
      } else {
        m.fuse -= dt;
        if (m.fuse <= 0) {                          // детонація
          explode(m.pos.x, m.pos.y + 0.6, m.pos.z, 'creeper');
          m.health = 0;
          m.detonated = true;
          return;
        }
      }
    } else if (chase && distH < CREEPER_IGNITE_DIST) {
      m.fuse = CREEPER_FUSE_TIME;                    // запал
      Sound.creeperHiss();
    }
  }
  const fusing = isCreeper && m.fuse > 0;

  // Скелет: тримає дистанцію (кайтить) і пускає стрілу, маючи лінію зору
  let skelMove = 0;       // -1 відступ, 0 стояти й стріляти, +1 наближення
  if (isSkeleton && chase) {
    if (distH < SKEL_NEAR) skelMove = -1;
    else if (distH > SKEL_FAR) skelMove = 1;
    if (m.shootCD > 0) m.shootCD -= dt;
    const canShoot = distH < SKEL_SHOOT_RANGE && m.shootCD <= 0 && mobCanSeePlayer(m);
    if (canShoot) {
      m.aimAnim = Math.min(1, m.aimAnim + dt * 4);   // ~0.25 с на натяг — видимий «тель»
      if (m.aimAnim >= 1) {
        spawnMobArrow(m);
        m.shootCD = SKEL_SHOOT_CD + Math.random() * 0.8;
        m.aimAnim = 0;
      }
    } else {
      m.aimAnim = Math.max(0, m.aimAnim - dt * 3);
    }
  }

  let moving, sp;
  if (isSkeleton) {
    moving = chase && skelMove !== 0;
    sp = skelMove * m.speed;                          // знак задає напрям (наближення/відступ)
  } else {
    moving = chase && distH > 1.0 && !fusing;
    sp = moving ? m.speed : 0;
  }
  m.vel.x = -Math.sin(m.yaw) * sp;
  m.vel.z = -Math.cos(m.yaw) * sp;

  const inWater = isWaterId(blockAt(
    Math.floor(m.pos.x), Math.floor(m.pos.y + 0.3), Math.floor(m.pos.z)
  ));
  if (inWater) m.vel.y = Math.min(m.vel.y + 40 * dt, 3);
  else m.vel.y -= 24 * dt;

  m.onGround = false;
  moveEntityAxis(m, 'y', m.vel.y * dt);
  const bumpedX = moveEntityAxis(m, 'x', m.vel.x * dt);
  const bumpedZ = moveEntityAxis(m, 'z', m.vel.z * dt);
  if ((bumpedX || bumpedZ) && m.onGround && moving) m.vel.y = 7.5; // перестрибнути

  // Атака при контакті (лише зомбі; кріпер шкодить вибухом, скелет — стрілами)
  if (m.attackCD > 0) m.attackCD -= dt;
  if (!isCreeper && !isSkeleton) {
    const vOverlap = player.pos.y < m.pos.y + m.height &&
                     player.pos.y + player.height > m.pos.y;
    if (chase && distH < 1.2 && vOverlap && m.attackCD <= 0 && !player.dead) {
      damagePlayer(3, 'zombie');
      const k = distH || 1;
      player.vel.x += (dx / k) * 4;
      player.vel.z += (dz / k) * 4;
      player.vel.y += 3;
      m.attackCD = 1.0;
      m.attackAnim = 1;
    }
  }

  // Анімація ніг (і рук у зомбі)
  if (moving && (m.onGround || inWater)) m.legPhase += dt * 8;
  const legSwing = Math.sin(m.legPhase) * 0.5 * (moving ? 1 : 0);
  if (isCreeper) {
    // Чотири лапи: передня й задня діагоналі гойдаються в протифазі
    m.legs[0].rotation.x = legSwing;
    m.legs[1].rotation.x = -legSwing;
    m.legs[2].rotation.x = -legSwing;
    m.legs[3].rotation.x = legSwing;
  } else if (isSkeleton) {
    m.legs[0].rotation.x = legSwing;
    m.legs[1].rotation.x = -legSwing;
    // Руки витягнуті вперед із луком; під час прицілювання піднімаються до горизонталі
    const armBase = -1.2 - m.aimAnim * 0.37;     // 0 → майже -π/2 (на рівень очей)
    m.arms[0].rotation.x = armBase;              // ліва тягне «тятиву»
    m.arms[1].rotation.x = armBase;              // права тримає лук
  } else {
    m.legs[0].rotation.x = legSwing;
    m.legs[1].rotation.x = -legSwing;
    if (m.attackAnim > 0) m.attackAnim = Math.max(0, m.attackAnim - dt * 3);
    const armBase = -1.35;                       // витягнуті вперед
    const armSwing = Math.sin(m.legPhase) * 0.18 + m.attackAnim * 0.6;
    m.arms[0].rotation.x = armBase - armSwing;
    m.arms[1].rotation.x = armBase + armSwing;
  }

  // Кріпер під час ґноту набрякає й блимає білим у наростаючому ритмі
  if (isCreeper) {
    if (m.fuse > 0) {
      const k = 1 - m.fuse / CREEPER_FUSE_TIME;       // 0 → 1 до вибуху
      m.group.scale.setScalar(1 + k * 0.35);
      const blink = Math.sin(k * k * 40) > 0 ? 1 : 0; // частішає до кінця
      for (const mat of m.mats) mat.emissive.setRGB(blink, blink, blink * 0.7);
    } else if (m.group.scale.x !== 1) {
      m.group.scale.setScalar(1);
      for (const mat of m.mats) mat.emissive.setRGB(0, 0, 0);
    }
  }

  // Червоний спалах при отриманні удару (перекриває блимання ґноту)
  if (m.hurt > 0) {
    m.hurt = Math.max(0, m.hurt - dt * 3);
    for (const mat of m.mats) mat.emissive.setRGB(m.hurt * 0.6, 0, 0);
  }

  m.group.position.copy(m.pos);
  m.group.rotation.y = m.yaw;
}

let groanTimer = 3;

function updateMobs(dt) {
  mobSpawnTimer -= dt;
  if (mobSpawnTimer <= 0) {
    trySpawnMob();
    mobSpawnTimer = 3;
  }
  // Випадкові стогони, коли неподалік є зомбі (частіше — коли їх більше)
  if (mobs.length > 0) {
    groanTimer -= dt;
    if (groanTimer <= 0) {
      const near = mobs.some((m) => m.type === 'zombie' && m.pos.distanceTo(player.pos) < 22);
      if (near) Sound.mobGroan();
      groanTimer = 2.5 + Math.random() * 4;
    }
  }
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.health <= 0) {
      if (!m.detonated) {                            // кріпер, що вибухнув, уже дав ефекти
        const deathColor = m.type === 'creeper' ? CREEPER_COLOR
          : m.type === 'skeleton' ? SKELETON_COLOR : ZOMBIE_COLOR;
        spawnParticles(m.pos.x, m.pos.y + 0.9, m.pos.z, deathColor, 16,
          { radius: 0.4, speed: 3, upBias: 1.2, life: 0.7, size: 0.13 });
        Sound.mobDeath();
      }
      if (m.type === 'creeper') unlockAch('creeper');
      else if (m.type === 'skeleton') unlockAch('skeleton');
      else unlockAch('zombie');
      removeMob(i);
      continue;
    }
    if (m.pos.distanceTo(player.pos) > MOB_DESPAWN_DIST || m.pos.y < -10) {
      removeMob(i);
      continue;
    }
    updateMob(m, dt);
  }
}

// Удар гравця по зомбі (ЛКМ). Повертає true, якщо влучив у ворога —
// тоді цей клік не починає видобуток блока.
const MELEE_REACH = 3.4;
const MEAT_COLOR = new THREE.Color(0xc0392b);
const WOOL_COLOR = new THREE.Color(0xe9e6df);
const _atkDir = new THREE.Vector3();

// Удар гравця по найближчій істоті в прицілі (зомбі або тварині).
// Зомбі гинуть у updateMobs; тварини — тут, лишаючи сире м'ясо.
function tryAttack() {
  if (!mobs.length && !animals.length) return false;
  camera.getWorldDirection(_atkDir);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let best = null, bestDist = Infinity, bestIsAnimal = false;
  const consider = (e, isAnimal) => {
    if (e.tamed) return;                          // свого вовка не б'ємо
    const tx = e.pos.x - ox;
    const ty = e.pos.y + e.height * 0.5 - oy;
    const tz = e.pos.z - oz;
    const dist = Math.hypot(tx, ty, tz);
    if (dist > MELEE_REACH) return;
    const dot = (tx * _atkDir.x + ty * _atkDir.y + tz * _atkDir.z) / (dist || 1);
    if (dot < 0.55) return;                       // має бути приблизно в прицілі
    if (dist < bestDist) { bestDist = dist; best = e; bestIsAnimal = isAnimal; }
  };
  for (const m of mobs) consider(m, false);
  // Власного коня під сідлом не вдарити (він просто під камерою вершника)
  for (const a of animals) { if (a !== ridingHorse) consider(a, true); }
  if (!best) return false;

  triggerSwing();
  // Напрям відкидання — від гравця до істоти, по горизонталі
  const dx = best.pos.x - player.pos.x, dz = best.pos.z - player.pos.z;
  damageEntity(best, bestIsAnimal, 5, dx, dz, 4);
  return true;
}

// Спільне завдання шкоди істоті (зомбі/кріпер або тварина) ударом чи стрілою.
// Зомбі/кріпери гинуть у updateMobs (там ефекти смерті); тварини — тут, лишаючи
// сире м'ясо. (kx,kz) — горизонтальний напрям відкидання, kup — вертикальний поштовх.
function damageEntity(entity, isAnimal, dmg, kx, kz, kup) {
  // Нестрижена вівця: перший удар зістригає руно замість шкоди — хмарка вовни,
  // «вжик» ножиць, вівця лякається й тікає; руно відростає з часом
  if (isAnimal && entity.wool) {
    entity.wool = false;
    entity.woolTimer = WOOL_REGROW_TIME;
    for (const m of entity.woolMeshes) m.visible = false;
    entity.panic = 3;
    spawnParticles(entity.pos.x, entity.pos.y + entity.height * 0.6, entity.pos.z,
      WOOL_COLOR, 12, { radius: 0.4, speed: 2.2, upBias: 1.2, life: 0.8, size: 0.13 });
    Sound.shear();
    unlockAch('shear');
    return;
  }
  entity.health -= dmg;
  entity.hurt = 1;
  const d = Math.hypot(kx, kz) || 1;
  entity.vel.x += (kx / d) * 8;
  entity.vel.z += (kz / d) * 8;
  entity.vel.y += kup;

  if (isAnimal) {
    entity.panic = 4;                              // тварина кидається тікати
    if (entity.health <= 0) {
      player.food = Math.min(FOOD_MAX, player.food + entity.foodValue);
      spawnParticles(entity.pos.x, entity.pos.y + entity.height * 0.5, entity.pos.z,
        MEAT_COLOR, 12, { radius: 0.35, speed: 2.6, upBias: 1.1, life: 0.7, size: 0.12 });
      Sound.mobDeath();
      const idx = animals.indexOf(entity);
      if (idx >= 0) removeAnimal(idx);
      updateFoodHud();
      unlockAch('hunt');
    } else {
      Sound.mobHit();
    }
  } else {
    Sound.mobHit();
  }
}

// Спільний обробник ЛКМ / кнопки «добувати»: спершу удар по істоті,
// інакше — почати видобуток блока.
function startBreakOrAttack() {
  if (hotbar[selectedSlot] === BOW) { startBowDraw(); return; }
  if (hotbar[selectedSlot] === ROD) { castOrReel(); return; }
  if (tryAttack()) return;
  // Двері в прицілі (промінь по клітинках дверей) → зняти їх
  if (doors.size > 0) {
    const d = doorInSight();
    if (d) { breakDoor(d); triggerSwing(); return; }
  }
  // Паркан чи хвіртка в прицілі → зняти
  if (fences.size > 0 || gates.size > 0) {
    const fg = fenceOrGateInSight();
    if (fg) {
      if (fg.fence) breakFence(fg.fence); else breakGate(fg.gate);
      triggerSwing();
      return;
    }
  }
  // Зняти смолоскип/драбину/саджанець або зібрати посів, якщо дивимось на них
  // (клітинка перед блоком)
  if (torches.size > 0 || crops.size > 0 || ladders.size > 0 || saplings.size > 0) {
    const hit = raycastBlock();
    if (hit && hit.prev) {
      const key = torchKey(hit.prev[0], hit.prev[1], hit.prev[2]);
      if (torches.has(key)) {
        spawnParticles(hit.prev[0] + 0.5, hit.prev[1] + 0.4, hit.prev[2] + 0.5, torchEmber, 6,
          { radius: 0.2, speed: 1.4, upBias: 0.8, life: 0.5, size: 0.07, gravity: 6 });
        Sound.torch(0.1);
        removeTorch(key);
        triggerSwing();
        return;
      }
      if (ladders.has(key)) {
        spawnParticles(hit.prev[0] + 0.5, hit.prev[1] + 0.5, hit.prev[2] + 0.5, LADDER_COLOR, 6,
          { radius: 0.25, speed: 1.4, upBias: 0.4, life: 0.45, size: 0.09, gravity: 10 });
        Sound.place(PLANK);
        removeLadder(key);
        triggerSwing();
        return;
      }
      const crop = crops.get(key);
      if (crop) {
        harvestCrop(crop);
        triggerSwing();
        return;
      }
      if (saplings.has(key)) {
        spawnParticles(hit.prev[0] + 0.5, hit.prev[1] + 0.3, hit.prev[2] + 0.5,
          new THREE.Color(0x3e7d2c), 6,
          { radius: 0.25, speed: 1.6, upBias: 0.8, life: 0.5, size: 0.08, gravity: 8 });
        Sound.breakBlock(LEAVES);
        removeSapling(key);
        triggerSwing();
        return;
      }
    }
  }
  mining = true;
}

// ============================================================
// Лук і стріли: натягування лука та снаряди-стріли
// ============================================================
// Стріла — короткоживуча сутність-снаряд (як TNT/частинки): летить із
// гравітацією, б'є істот на відстані й встромляється у блоки, не змінюючи
// воксельну сітку. Стан натягу лука керує силою (швидкість + шкода).
const arrows = [];
const ARROW_MAX = 24;            // межа одночасних стріл у світі
const ARROW_GRAVITY = 18;        // прискорення падіння стріли, бл/с²
const ARROW_STUCK_LIFE = 12;     // секунд, поки встромлена стріла зникне
const ARROW_FLY_LIFE = 8;        // секунд польоту до зникнення (промах)
const ARROW_HIT_R = 0.45;        // радіус влучання стріли в істоту
const BOW_DRAW_TIME = 0.85;      // секунд до повного натягу
const BOW_MIN_POWER = 0.12;      // менший натяг — постріл не відбувається
const _arrowDir = new THREE.Vector3();
const _arrowFwd = new THREE.Vector3(0, 0, 1); // поздовжня вісь геометрії стріли

// Спільні ресурси моделі стріли (геометрії/матеріали не дублюються на кожну стрілу)
const ARROW_SHAFT_GEO = new THREE.CylinderGeometry(0.02, 0.02, 0.55, 5);
ARROW_SHAFT_GEO.rotateX(Math.PI / 2);                       // уздовж +Z
const ARROW_HEAD_GEO = new THREE.ConeGeometry(0.045, 0.13, 5);
ARROW_HEAD_GEO.rotateX(Math.PI / 2);
ARROW_HEAD_GEO.translate(0, 0, 0.33);
const ARROW_FLETCH_GEO = new THREE.PlaneGeometry(0.11, 0.09);
ARROW_FLETCH_GEO.translate(0, 0, -0.24);
const ARROW_SHAFT_MAT = new THREE.MeshLambertMaterial({ color: 0xc9a66b });
const ARROW_HEAD_MAT = new THREE.MeshLambertMaterial({ color: 0x6b6f78 });
const ARROW_FLETCH_MAT = new THREE.MeshLambertMaterial({ color: 0xe2e2e2, side: THREE.DoubleSide });

function makeArrowModel() {
  const g = new THREE.Group();
  g.add(new THREE.Mesh(ARROW_SHAFT_GEO, ARROW_SHAFT_MAT));
  g.add(new THREE.Mesh(ARROW_HEAD_GEO, ARROW_HEAD_MAT));
  const f1 = new THREE.Mesh(ARROW_FLETCH_GEO, ARROW_FLETCH_MAT);
  const f2 = new THREE.Mesh(ARROW_FLETCH_GEO, ARROW_FLETCH_MAT);
  f2.rotation.z = Math.PI / 2;
  g.add(f1, f2);
  return g;
}

function disposeArrow(a) {
  scene.remove(a.group);                                    // спільні геометрії — не чіпаємо
}

function orientArrow(a) {
  if (a.vel.lengthSq() < 1e-6) return;
  _arrowDir.copy(a.vel).normalize();
  a.group.quaternion.setFromUnitVectors(_arrowFwd, _arrowDir);
}

// Натяг лука (power 0..1) задає швидкість і шкоду стріли
function spawnArrow(power) {
  if (arrows.length >= ARROW_MAX) disposeArrow(arrows.shift());
  camera.getWorldDirection(_arrowDir);
  const speed = 22 + power * 30;                            // 22..52 бл/с
  const group = makeArrowModel();
  const a = {
    group,
    pos: new THREE.Vector3(
      camera.position.x + _arrowDir.x * 0.5,
      camera.position.y + _arrowDir.y * 0.5 - 0.06,
      camera.position.z + _arrowDir.z * 0.5
    ),
    vel: _arrowDir.clone().multiplyScalar(speed),
    life: 0,
    stuck: false,
    dmg: Math.round(3 + power * 5),                         // 3..8 (мілі-удар = 5)
    fromMob: false,                                         // стріла гравця — б'є ворогів
  };
  group.position.copy(a.pos);
  orientArrow(a);
  scene.add(group);
  arrows.push(a);
  return a;
}

// Стріла скелета: летить у гравця з компенсацією падіння й невеликим розкидом
const MOB_ARROW_SPEED = 26;
const MOB_ARROW_DMG = 3;
const _mobArrowDir = new THREE.Vector3();

function spawnMobArrow(m) {
  if (arrows.length >= ARROW_MAX) disposeArrow(arrows.shift());
  const ox = m.pos.x - Math.sin(m.yaw) * 0.3;              // біля «кисті» скелета
  const oy = m.pos.y + 1.5;
  const oz = m.pos.z - Math.cos(m.yaw) * 0.3;
  const dx = player.pos.x - ox;
  const dz = player.pos.z - oz;
  const horiz = Math.hypot(dx, dz) || 0.0001;
  const t = horiz / MOB_ARROW_SPEED;                       // приблизний час польоту
  const drop = 0.5 * ARROW_GRAVITY * t * t;                // підняти приціл на падіння стріли
  const aimY = (player.pos.y + player.height * 0.5) + drop - oy;
  _mobArrowDir.set(dx, aimY, dz).normalize();
  const spread = 0.04;                                     // легкий розкид — не снайпер
  _mobArrowDir.x += (Math.random() - 0.5) * spread;
  _mobArrowDir.y += (Math.random() - 0.5) * spread;
  _mobArrowDir.z += (Math.random() - 0.5) * spread;
  _mobArrowDir.normalize();
  const group = makeArrowModel();
  const a = {
    group,
    pos: new THREE.Vector3(ox, oy, oz),
    vel: _mobArrowDir.clone().multiplyScalar(MOB_ARROW_SPEED),
    life: 0,
    stuck: false,
    dmg: MOB_ARROW_DMG,
    fromMob: true,                                         // стріла ворога — б'є гравця
  };
  group.position.copy(a.pos);
  orientArrow(a);
  scene.add(group);
  arrows.push(a);
  Sound.bowShoot(0.6);
  return a;
}

// Перевірити влучання стріли в найближчу істоту (зомбі/кріпер або тварину)
function arrowHitEntity(a) {
  const check = (e) => {
    const dy = a.pos.y - (e.pos.y + e.height * 0.5);
    if (Math.abs(dy) > e.height * 0.5 + ARROW_HIT_R) return false;
    const dx = a.pos.x - e.pos.x, dz = a.pos.z - e.pos.z;
    const r = ARROW_HIT_R + e.halfW;
    return dx * dx + dz * dz <= r * r;
  };
  for (const m of mobs) {
    if (check(m)) { damageEntity(m, false, a.dmg, a.vel.x, a.vel.z, 3); return true; }
  }
  for (const an of animals) {
    if (an.tamed) continue;                       // стріли не ранять свого вовка
    if (check(an)) { damageEntity(an, true, a.dmg, a.vel.x, a.vel.z, 3); return true; }
  }
  return false;
}

// Влучання стріли скелета в гравця: відкид у напрямі польоту + шкода
function arrowHitPlayer(a) {
  if (player.dead) return false;
  const dy = a.pos.y - (player.pos.y + player.height * 0.5);
  if (Math.abs(dy) > player.height * 0.5 + ARROW_HIT_R) return false;
  const dx = a.pos.x - player.pos.x, dz = a.pos.z - player.pos.z;
  const r = ARROW_HIT_R + player.halfW;
  if (dx * dx + dz * dz > r * r) return false;
  damagePlayer(a.dmg, 'arrow');
  const k = Math.hypot(a.vel.x, a.vel.z) || 1;
  player.vel.x += (a.vel.x / k) * 3;
  player.vel.z += (a.vel.z / k) * 3;
  return true;
}

function updateArrows(dt) {
  for (let i = arrows.length - 1; i >= 0; i--) {
    const a = arrows[i];
    a.life += dt;
    if (a.stuck) {
      if (a.life > ARROW_STUCK_LIFE) { disposeArrow(a); arrows.splice(i, 1); }
      continue;
    }
    a.vel.y -= ARROW_GRAVITY * dt;
    // Рух дрібними підкроками, щоб швидка стріла не «прострілювала» блок/істоту
    const steps = Math.max(1, Math.ceil(a.vel.length() * dt / 0.3));
    let outcome = '';                                       // '' | 'entity' | 'block'
    for (let s = 0; s < steps; s++) {
      a.pos.x += a.vel.x * dt / steps;
      a.pos.y += a.vel.y * dt / steps;
      a.pos.z += a.vel.z * dt / steps;
      const hit = a.fromMob ? arrowHitPlayer(a) : arrowHitEntity(a);
      if (hit) { outcome = 'entity'; break; }
      const acx = Math.floor(a.pos.x), acy = Math.floor(a.pos.y), acz = Math.floor(a.pos.z);
      const bid = blockAt(acx, acy, acz);
      const inDoor = !isSolid(bid) &&
        (doorBlocksCell(acx, acy, acz) || fenceSolidAtCell(acx, acy, acz));
      if (isSolid(bid) || inDoor) {
        outcome = 'block';
        Sound.arrowHit();
        spawnParticles(a.pos.x, a.pos.y, a.pos.z, blockColor(inDoor ? PLANK : bid), 4,
          { radius: 0.18, speed: 1.6, upBias: 0.6, life: 0.4, size: 0.07, gravity: 10 });
        break;
      }
    }
    if (outcome === 'entity') {
      disposeArrow(a); arrows.splice(i, 1);
    } else if (outcome === 'block') {
      a.stuck = true; a.life = 0;
      a.group.position.copy(a.pos);
    } else if (a.pos.y < -20 || a.life > ARROW_FLY_LIFE) {
      disposeArrow(a); arrows.splice(i, 1);
    } else {
      a.group.position.copy(a.pos);
      orientArrow(a);
    }
  }
}

// ===== Стан натягу лука =====
const bow = { drawing: false, charge: 0 };

function startBowDraw() {
  if (bow.drawing) return;
  bow.drawing = true;
  bow.charge = 0;
  Sound.bowDraw();
}

function cancelBowDraw() {
  bow.drawing = false;
  bow.charge = 0;
}

function releaseBow() {
  if (!bow.drawing) return;
  const power = bow.charge;
  cancelBowDraw();
  if (power < BOW_MIN_POWER) return;                        // ледь натягнутий — без пострілу
  spawnArrow(power);
  Sound.bowShoot(power);
  triggerSwing();
  unlockAch('archer');
}

// ============================================================
// Риболовля: вудка закидає поплавок у воду, ловить рибу в торбу їжі
// ============================================================
// Поплавок — легка сутність у світовій сцені (як TNT/стріли): не змінює
// воксельну сітку. ЛКМ вудкою закидає поплавок уздовж погляду; над водою за
// кілька секунд «клює» (поплавок сіпається під воду + плюскіт), і повторний
// ЛКМ у вікні підсічки витягує рибу в ту саму торбу їжі, що й полювання.
const FISH_FOOD = 5;             // скільки одиниць їжі дає впіймана риба
const FISH_MIN_WAIT = 2.5;       // мін. очікування клювання, с
const FISH_MAX_WAIT = 9;         // макс. очікування клювання, с
const FISH_BITE_WINDOW = 1.3;    // скільки секунд можна підсікти після клювання
const ROD_RANGE = 7;             // дальність закиду вздовж погляду, блоки

const fishing = {
  active: false,
  inWater: false,
  x: 0, y: 0, z: 0,        // базова позиція поплавка (поверхня води)
  waitTimer: 0,
  biting: false,
  biteTimer: 0,
  phase: 0,
};

// Поплавок (червоний низ + білий верх) і волосінь — створюємо раз, ховаємо/показуємо
const bobberGroup = new THREE.Group();
bobberGroup.add(new THREE.Mesh(
  new THREE.SphereGeometry(0.09, 8, 6),
  new THREE.MeshLambertMaterial({ color: 0xd63a2f })
));
const _bobberTop = new THREE.Mesh(
  new THREE.SphereGeometry(0.075, 8, 6),
  new THREE.MeshLambertMaterial({ color: 0xf2f2f2 })
);
_bobberTop.position.y = 0.085;
bobberGroup.add(_bobberTop);
bobberGroup.visible = false;
scene.add(bobberGroup);

const _fishLineGeo = new THREE.BufferGeometry();
_fishLineGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
const fishingLine = new THREE.Line(
  _fishLineGeo,
  new THREE.LineBasicMaterial({ color: 0xf5f5f5, transparent: true, opacity: 0.55 })
);
fishingLine.visible = false;
fishingLine.frustumCulled = false;
scene.add(fishingLine);

const _rodRight = new THREE.Vector3();
const _rodFwd = new THREE.Vector3();
const _rodUp = new THREE.Vector3(0, 1, 0);
// Приблизна світова позиція кінчика вудлища — точка, від якої йде волосінь
function getRodTipWorld() {
  camera.getWorldDirection(_rodFwd);
  _rodRight.crossVectors(_rodFwd, _rodUp).normalize();
  return camera.position.clone()
    .addScaledVector(_rodFwd, 0.6)
    .addScaledVector(_rodRight, 0.28)
    .addScaledVector(_rodUp, -0.22);
}

// Знайти поверхню води вздовж променя погляду (або точку, де поплавок «падає»)
function findBobberTarget() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const start = camera.position.clone();
  const step = 0.1;
  let prev = start.clone();
  for (let t = 0; t < ROD_RANGE; t += step) {
    const p = start.clone().addScaledVector(dir, t);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const id = blockAt(bx, by, bz);
    if (isWaterId(id)) {
      let surf = by;                                  // піднятись до поверхні колони
      while (isWaterId(blockAt(bx, surf + 1, bz))) surf++;
      return { x: bx + 0.5, y: surf + 0.85, z: bz + 0.5, inWater: true };
    }
    if (isSolid(id)) return { x: prev.x, y: prev.y, z: prev.z, inWater: false };
    prev = p;
  }
  return { x: prev.x, y: prev.y, z: prev.z, inWater: false };
}

function rollBiteWait() {
  const wetBonus = weatherState === 'rain' ? 0.6 : 1;   // дощ — риба активніша
  return (FISH_MIN_WAIT + Math.random() * (FISH_MAX_WAIT - FISH_MIN_WAIT)) * wetBonus;
}

function castRod() {
  const target = findBobberTarget();
  fishing.active = true;
  fishing.inWater = target.inWater;
  fishing.x = target.x; fishing.y = target.y; fishing.z = target.z;
  fishing.biting = false;
  fishing.phase = 0;
  fishing.waitTimer = target.inWater ? rollBiteWait() : Infinity;  // не над водою — не клює
  bobberGroup.position.set(target.x, target.y, target.z);
  bobberGroup.visible = true;
  fishingLine.visible = true;
  triggerSwing();
  Sound.cast();
  if (target.inWater) {
    spawnParticles(target.x, target.y, target.z, blockColor(WATER), 8,
      { radius: 0.25, speed: 1.6, upBias: 0.8, life: 0.4, size: 0.06, gravity: 8 });
  }
}

function reelIn() {
  if (!fishing.active) return;
  const wasBiting = fishing.biting;
  const overWater = fishing.inWater;
  fishing.active = false;
  fishing.biting = false;
  bobberGroup.visible = false;
  fishingLine.visible = false;
  triggerSwing();
  if (wasBiting) {                                   // підсічка вдалась — риба в торбу їжі
    player.food = Math.min(FOOD_MAX, player.food + FISH_FOOD);
    updateFoodHud();
    Sound.reelCatch();
    unlockAch('fisher');
    spawnParticles(fishing.x, fishing.y, fishing.z, blockColor(WATER), 10,
      { radius: 0.3, speed: 2.2, upBias: 1, life: 0.5, size: 0.07, gravity: 9 });
  } else if (overWater) {
    Sound.splash();
  }
}

// ЛКМ вудкою: перший клік закидає, наступний — змотує (з рибою, якщо клює)
function castOrReel() {
  if (fishing.active) reelIn();
  else castRod();
}

function updateFishing(dt) {
  if (!fishing.active) return;
  if (hotbar[selectedSlot] !== ROD) { reelIn(); return; }   // змінили предмет — змотати

  fishing.phase += dt;
  let y = fishing.y;
  if (fishing.inWater) {
    if (fishing.biting) {
      fishing.biteTimer -= dt;
      y = fishing.y - 0.18 - Math.abs(Math.sin(fishing.phase * 14)) * 0.06;  // сіпається під воду
      if (fishing.biteTimer <= 0) {                 // проґавили підсічку — знову чекаємо
        fishing.biting = false;
        fishing.waitTimer = rollBiteWait();
      }
    } else {
      y = fishing.y + Math.sin(fishing.phase * 2.2) * 0.05;  // спокійне погойдування
      fishing.waitTimer -= dt;
      if (fishing.waitTimer <= 0) {
        fishing.biting = true;
        fishing.biteTimer = FISH_BITE_WINDOW;
        Sound.bite();
        spawnParticles(fishing.x, fishing.y, fishing.z, blockColor(WATER), 6,
          { radius: 0.2, speed: 1.4, upBias: 0.7, life: 0.4, size: 0.05, gravity: 8 });
      }
    }
  }
  bobberGroup.position.set(fishing.x, y, fishing.z);

  const tip = getRodTipWorld();                       // волосінь: кінчик вудлища → поплавок
  const arr = fishingLine.geometry.attributes.position.array;
  arr[0] = tip.x; arr[1] = tip.y; arr[2] = tip.z;
  arr[3] = fishing.x; arr[4] = y; arr[5] = fishing.z;
  fishingLine.geometry.attributes.position.needsUpdate = true;
}

// ============================================================
// Динаміт
// ============================================================
const TNT_FUSE = 2.2;
const TNT_RADIUS = 3.5;
const primedTnt = [];
const explosionFx = [];

function igniteTnt(x, y, z, fuse = TNT_FUSE) {
  setBlock(x, y, z, AIR);
  unlockAch('boom');
  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.98, 0.98, 0.98),
    new THREE.MeshLambertMaterial({ color: 0xb53a2e })
  );
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  scene.add(mesh);
  primedTnt.push({ mesh, x, y, z, timer: fuse, fuseT: 0 });
}

function knockback(entity, cx, cy, cz) {
  const center = new THREE.Vector3(
    entity.pos.x, entity.pos.y + entity.height / 2, entity.pos.z
  );
  const d = center.distanceTo(new THREE.Vector3(cx, cy, cz));
  if (d > 8) return;
  const power = (1 - d / 8) * 14;
  const dir = center.sub(new THREE.Vector3(cx, cy, cz)).normalize();
  entity.vel.x += dir.x * power;
  entity.vel.z += dir.z * power;
  entity.vel.y += Math.abs(dir.y) * power * 0.5 + power * 0.4;
}

function explode(cx, cy, cz, cause = 'tnt') {
  const r = Math.ceil(TNT_RADIUS);
  const bx = Math.floor(cx), by = Math.floor(cy), bz = Math.floor(cz);
  for (let x = bx - r; x <= bx + r; x++) {
    for (let y = by - r; y <= by + r; y++) {
      for (let z = bz - r; z <= bz + r; z++) {
        const dx = x + 0.5 - cx, dy = y + 0.5 - cy, dz = z + 0.5 - cz;
        if (dx * dx + dy * dy + dz * dz > TNT_RADIUS * TNT_RADIUS) continue;
        const id = blockAt(x, y, z);
        if (id === AIR || isWaterId(id)) continue;
        if (id === TNT) {
          igniteTnt(x, y, z, 0.3 + Math.random() * 0.5); // ланцюгова детонація
        } else {
          setBlock(x, y, z, AIR);
        }
      }
    }
  }

  validateTorches();  // вибух міг знести опору або клітинки смолоскипів
  validateCrops();    // ... і опору/клітинки посівів
  validateBeds();     // ... і опору/клітинки ліжок
  validateLadders();  // ... і опору/клітинки драбин
  validateDoors();    // ... і опору/клітинки дверей
  validateFences();   // ... і опору/клітинки парканів і хвірток
  validateSaplings(); // ... і опору/клітинки саджанців
  Sound.explosion();
  knockback(player, cx, cy, cz);
  for (const a of animals) knockback(a, cx, cy, cz);

  // Шкода гравцю від близького вибуху
  const pd = Math.hypot(
    player.pos.x - cx,
    player.pos.y + player.height / 2 - cy,
    player.pos.z - cz
  );
  if (pd < TNT_RADIUS + 2) {
    damagePlayer(Math.ceil((1 - pd / (TNT_RADIUS + 2)) * 14), cause);
  }

  // Спалах вибуху
  const fx = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9 })
  );
  fx.position.set(cx, cy, cz);
  scene.add(fx);
  explosionFx.push({ mesh: fx, t: 0 });

  // Дим, що піднімається, і розжарені іскри
  spawnParticles(cx, cy, cz, new THREE.Color(0x4a4a4a), 26,
    { radius: 1.2, speed: 4, upBias: 1.5, life: 1.1, size: 0.32, gravity: -3, drag: 1.4 });
  spawnParticles(cx, cy, cz, new THREE.Color(0xffb24a), 18,
    { radius: 0.9, speed: 7, upBias: 2, life: 0.6, size: 0.16, gravity: 14 });
}

function updateTnt(dt) {
  for (let i = primedTnt.length - 1; i >= 0; i--) {
    const t = primedTnt[i];
    t.timer -= dt;
    t.fuseT -= dt;
    if (t.fuseT <= 0) { Sound.fuse(); t.fuseT = 0.18; } // тиктакання ґнота
    t.mesh.material.color.setHex(Math.sin(t.timer * 18) > 0 ? 0xffffff : 0xb53a2e);
    if (t.timer <= 0) {
      scene.remove(t.mesh);
      t.mesh.geometry.dispose();
      t.mesh.material.dispose();
      primedTnt.splice(i, 1);
      explode(t.x + 0.5, t.y + 0.5, t.z + 0.5);
    }
  }
  for (let i = explosionFx.length - 1; i >= 0; i--) {
    const e = explosionFx[i];
    e.t += dt;
    const k = e.t / 0.45;
    if (k >= 1) {
      scene.remove(e.mesh);
      e.mesh.geometry.dispose();
      e.mesh.material.dispose();
      explosionFx.splice(i, 1);
    } else {
      e.mesh.scale.setScalar(1 + k * (TNT_RADIUS + 1.5));
      e.mesh.material.opacity = 0.9 * (1 - k);
    }
  }
}

// ============================================================
// Сипкі блоки під гравітацією: пісок і гравій падають окремою сутністю,
// коли під ними зникає опора (видобуток, вибух, потік води). Сутність — куб
// із текстурою блока; досягнувши твердої поверхні, знову стає вокселем.
// ============================================================
const fallingBlocks = [];
const FALL_GRAVITY = 26;          // прискорення падіння, бл/с²
const FALL_MAX = 96;              // запобіжник: межа одночасних падаючих блоків

// Геометрія куба з UV, напнутими на бічний тайл блока (кеш на тип блока).
const _fallGeoCache = new Map();
function fallingGeo(id) {
  if (_fallGeoCache.has(id)) return _fallGeoCache.get(id);
  const tile = (BLOCK_TILES[id] || BLOCK_TILES[STONE]).side;
  const { u0, u1, v0, v1 } = tileUV(tile);
  const geo = new THREE.BoxGeometry(0.96, 0.96, 0.96);
  const uv = geo.attributes.uv;
  const corners = [[u0, v1], [u1, v1], [u0, v0], [u1, v0]];
  for (let f = 0; f < 6; f++) {
    for (let c = 0; c < 4; c++) uv.setXY(f * 4 + c, corners[c][0], corners[c][1]);
  }
  uv.needsUpdate = true;
  _fallGeoCache.set(id, geo);
  return geo;
}

// Створити падаючий блок із клітинки (x,y,z); y — нижня грань куба (ціле).
function spawnFallingBlock(x, y, z, id) {
  if (fallingBlocks.length >= FALL_MAX) return;
  const mesh = new THREE.Mesh(fallingGeo(id), materials.solid);
  mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  scene.add(mesh);
  fallingBlocks.push({ mesh, x, y, z, id, vel: 0 });
}

function updateFallingBlocks(dt) {
  // 1) Запустити падіння для запланованих клітинок (сипкий блок без опори знизу)
  if (gravityQueue.size) {
    const cells = [...gravityQueue];
    gravityQueue.clear();
    for (const key of cells) {
      const [x, y, z] = key.split(',').map(Number);
      if (y <= 0 || !isFalling(blockAt(x, y, z))) continue;
      if (isSolid(blockAt(x, y - 1, z))) continue;   // є тверда опора — лишається
      // Пул заповнений: не видаляти воксель (інакше блок зник би) — перепланувати.
      if (fallingBlocks.length >= FALL_MAX) { scheduleGravity(x, y, z); continue; }
      const id = blockAt(x, y, z);
      setBlock(x, y, z, AIR);          // прибрати воксель (перепланує клітинку вище — ланцюг)
      spawnFallingBlock(x, y, z, id);
    }
  }
  // 2) Просувати наявні падаючі блоки й приземляти на першій твердій поверхні
  for (let i = fallingBlocks.length - 1; i >= 0; i--) {
    const f = fallingBlocks[i];
    f.vel -= FALL_GRAVITY * dt;
    f.y += f.vel * dt;
    f.mesh.position.y = f.y + 0.5;
    const cellBelow = Math.floor(f.y);               // клітинка, у яку зайшла нижня грань
    if (cellBelow >= 0 && !isSolid(blockAt(f.x, cellBelow, f.z))) continue;  // ще летить
    // Приземлення: стати на першу порожню клітинку над опорою
    let landY = cellBelow + 1;
    while (landY < HEIGHT && isSolid(blockAt(f.x, landY, f.z))) landY++;
    scene.remove(f.mesh);
    fallingBlocks.splice(i, 1);
    if (landY >= 0 && landY < HEIGHT) {
      setBlock(f.x, landY, f.z, f.id);
      Sound.land();
      spawnParticles(f.x + 0.5, landY + 0.05, f.z + 0.5, blockColor(f.id), 8,
        { radius: 0.4, speed: 1.6, upBias: 0.4, life: 0.4, size: 0.1, gravity: 12 });
      validateTorches();  // блок міг зайняти клітинку смолоскипа/посіву/ліжка
      validateCrops();
      validateBeds();
      validateLadders();
      validateDoors();
      validateFences();
      validateSaplings();
    }
  }
}

// ============================================================
// Частинки: уламки при руйнуванні, пил при встановленні, дим вибуху
// ============================================================
// Усі частинки малюються одним InstancedMesh (один виклик відмалювання),
// колір береться з усередненого кольору тайла блока в атласі.
const MAX_PARTICLES = 256;
const particles = [];
for (let i = 0; i < MAX_PARTICLES; i++) {
  particles.push({
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    quat: new THREE.Quaternion(),
    life: 0, maxLife: 1, size: 0.1, gravity: 18, drag: 0, active: false,
  });
}

const particleMesh = new THREE.InstancedMesh(
  new THREE.BoxGeometry(1, 1, 1),
  new THREE.MeshLambertMaterial(),
  MAX_PARTICLES
);
particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
particleMesh.frustumCulled = false;
{
  // Ініціалізуємо instanceColor (білий) і ховаємо всі частинки (нульовий масштаб)
  const white = new THREE.Color(1, 1, 1);
  const hide = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < MAX_PARTICLES; i++) {
    particleMesh.setColorAt(i, white);
    particleMesh.setMatrixAt(i, hide);
  }
}
scene.add(particleMesh);

// Усереднений колір бокового тайла блока (кешується)
const _blockColorCache = new Map();
function blockColor(id) {
  if (_blockColorCache.has(id)) return _blockColorCache.get(id);
  const tile = (BLOCK_TILES[id] || BLOCK_TILES[STONE]).side;
  const ox = (tile % ATLAS_COLS) * TILE, oy = Math.floor(tile / ATLAS_COLS) * TILE;
  const px = atlasCanvas.getContext('2d').getImageData(ox, oy, TILE, TILE).data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < px.length; i += 4) { r += px[i]; g += px[i + 1]; b += px[i + 2]; }
  const n = px.length / 4;
  const c = new THREE.Color(r / n / 255, g / n / 255, b / n / 255);
  _blockColorCache.set(id, c);
  return c;
}

const _pEuler = new THREE.Euler();
function spawnParticles(x, y, z, color, count, opts = {}) {
  const radius = opts.radius ?? 0.4;
  const speed = opts.speed ?? 3;
  const upBias = opts.upBias ?? 1;
  const life = opts.life ?? 0.6;
  const size = opts.size ?? 0.12;
  const gravity = opts.gravity ?? 18;
  const drag = opts.drag ?? 0;
  let spawned = 0, touched = false;
  for (let i = 0; i < MAX_PARTICLES && spawned < count; i++) {
    const p = particles[i];
    if (p.active) continue;
    p.active = true;
    p.pos.set(
      x + (Math.random() - 0.5) * 2 * radius,
      y + (Math.random() - 0.5) * 2 * radius,
      z + (Math.random() - 0.5) * 2 * radius
    );
    p.vel.set(
      (Math.random() - 0.5) * speed,
      Math.random() * speed * 0.6 + upBias,
      (Math.random() - 0.5) * speed
    );
    _pEuler.set(Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28);
    p.quat.setFromEuler(_pEuler);
    p.maxLife = p.life = life * (0.7 + Math.random() * 0.6);
    p.size = size * (0.7 + Math.random() * 0.7);
    p.gravity = gravity;
    p.drag = drag;
    particleMesh.setColorAt(i, color);
    spawned++;
    touched = true;
  }
  if (touched && particleMesh.instanceColor) particleMesh.instanceColor.needsUpdate = true;
}

const _pMat = new THREE.Matrix4();
const _pScale = new THREE.Vector3();
const _pHide = new THREE.Vector3(0, 0, 0);
const _pZeroQuat = new THREE.Quaternion();
const _pHidePos = new THREE.Vector3(0, -9999, 0);

function updateParticles(dt) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i];
    if (p.active) {
      p.life -= dt;
      if (p.life <= 0) {
        p.active = false;
      } else {
        p.vel.y -= p.gravity * dt;
        if (p.drag) p.vel.multiplyScalar(Math.max(0, 1 - p.drag * dt));
        p.pos.addScaledVector(p.vel, dt);
        // Просте зіткнення: якщо частинка зайшла у твердий блок — осідає зверху
        if (isSolid(blockAt(Math.floor(p.pos.x), Math.floor(p.pos.y), Math.floor(p.pos.z)))) {
          p.pos.y = Math.floor(p.pos.y) + 1 + p.size * 0.5;
          p.vel.set(p.vel.x * 0.3, 0, p.vel.z * 0.3);
        }
      }
    }
    if (p.active) {
      const k = Math.min(1, p.life / Math.min(p.maxLife, 0.3)); // зникають під кінець життя
      const s = Math.max(0.001, p.size * k);
      _pScale.set(s, s, s);
      _pMat.compose(p.pos, p.quat, _pScale);
    } else {
      _pMat.compose(_pHidePos, _pZeroQuat, _pHide);
    }
    particleMesh.setMatrixAt(i, _pMat);
  }
  particleMesh.instanceMatrix.needsUpdate = true;
}

// ===== Промінь погляду (вибір блока) =====
function raycastBlock(maxDist = 6) {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const pos = camera.position.clone();
  const step = 0.04;
  let prev = null;

  for (let t = 0; t < maxDist; t += step) {
    const p = pos.clone().addScaledVector(dir, t);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    if (prev && bx === prev[0] && by === prev[1] && bz === prev[2]) continue;
    const id = blockAt(bx, by, bz);
    if (isSolid(id)) {
      return { block: [bx, by, bz], prev };
    }
    prev = [bx, by, bz];
  }
  return null;
}

// ============================================================
// Смолоскипи: процедурне джерело світла, що ставиться у світ
// ============================================================
// Смолоскип — окрема сутність (модель + динамічне світло + іскри), а не
// воксельний блок: він не змінює сітку чанка й не блокує рух. Світять кілька
// найближчих смолоскипів (пул точкових ламп), решта дає лише полум'я-білборд.
const torches = new Map();             // "x,y,z" -> { x, y, z, face, dx, dz, group, tip, glow, mat, flick, ember }
const TORCH_MAX = 256;                 // межа, щоб збереження не розросталося
const TORCH_LIGHT_POOL = 6;            // скільки смолоскипів світять реально водночас
const TORCH_LIGHT_RANGE = 30;          // далі за це лампа не призначається

const torchGlowTex = makeGlowTexture('rgba(255,206,128,0.95)', 'rgba(255,140,40,0.4)');
const torchEmber = new THREE.Color(0xff7a1a);

// Пул точкових ламп: щокадру призначаються найближчим смолоскипам.
// Лампи завжди присутні (керуємо лише яскравістю), щоб не перекомпільовувати
// шейдер щоразу, як змінюється кількість активних смолоскипів.
const torchLights = [];
for (let i = 0; i < TORCH_LIGHT_POOL; i++) {
  const l = new THREE.PointLight(0xffb060, 0, 9, 1.6);
  scene.add(l);
  torchLights.push(l);
}

// ===== Динамічне світло лави =====
// Лава підсвічує довкілля теплим помаранчевим світлом. Пул точкових ламп, що
// щокадру (з тротлінгом) призначаються найближчим до камери відкритим клітинкам
// лави — так світять лише озера поблизу, без обходу всіх чанків.
const LAVA_LIGHT_POOL = 5;
const LAVA_SCAN_R = 7;              // радіус пошуку клітинок лави навколо камери
const lavaLights = [];
for (let i = 0; i < LAVA_LIGHT_POOL; i++) {
  const l = new THREE.PointLight(0xff5a1a, 0, 11, 1.7);
  scene.add(l);
  lavaLights.push(l);
}

let lavaLightTimer = 0;
let lavaFlick = 0;
const _lavaCells = [];
function updateLavaLights(dt) {
  lavaFlick += dt;
  // Мерехтіння яскравості вже призначених ламп — щокадру, дешево
  const flick = 0.86 + 0.14 * Math.sin(lavaFlick * 6.5);
  for (const l of lavaLights) if (l.userData.on) l.intensity = l.userData.base * flick;

  lavaLightTimer -= dt;
  if (lavaLightTimer > 0) return;
  lavaLightTimer = 0.2;

  const cx = Math.floor(camera.position.x);
  const cy = Math.floor(camera.position.y);
  const cz = Math.floor(camera.position.z);
  _lavaCells.length = 0;
  for (let y = cy - LAVA_SCAN_R; y <= cy + 3; y++) {
    if (y < 1 || y >= HEIGHT) continue;
    for (let x = cx - LAVA_SCAN_R; x <= cx + LAVA_SCAN_R; x++) {
      for (let z = cz - LAVA_SCAN_R; z <= cz + LAVA_SCAN_R; z++) {
        if (!isLavaId(blockAt(x, y, z))) continue;
        // Тільки відкрита поверхня лави (щось не тверде зверху або збоку) світить
        if (isSolid(blockAt(x, y + 1, z)) &&
            isSolid(blockAt(x + 1, y, z)) && isSolid(blockAt(x - 1, y, z)) &&
            isSolid(blockAt(x, y, z + 1)) && isSolid(blockAt(x, y, z - 1))) continue;
        const dx = x + 0.5 - camera.position.x;
        const dy = y + 0.5 - camera.position.y;
        const dz = z + 0.5 - camera.position.z;
        _lavaCells.push({ x, y, z, d2: dx * dx + dy * dy + dz * dz });
      }
    }
  }
  _lavaCells.sort((a, b) => a.d2 - b.d2);
  for (let i = 0; i < LAVA_LIGHT_POOL; i++) {
    const l = lavaLights[i];
    if (i < _lavaCells.length) {
      const c = _lavaCells[i];
      l.position.set(c.x + 0.5, c.y + 0.7, c.z + 0.5);
      l.userData.on = true;
      l.userData.base = 2.0;
    } else {
      l.userData.on = false;
      l.intensity = 0;
    }
  }

  // Фонове гудіння найближчого озера лави
  lavaAmbientTimer -= 0.2;
  if (lavaAmbientTimer <= 0) {
    lavaAmbientTimer = 1.6 + Math.random() * 2.4;
    if (_lavaCells.length && _lavaCells[0].d2 < 90) Sound.lava(0.05);
  }
}
let lavaAmbientTimer = 2;

// Модель: брунатна паличка + розжарений кінчик + м'яке гало-білборд
function makeTorchModel() {
  const g = new THREE.Group();
  animalBox(g, 0.11, 0.5, 0.11, 0x6b4a2b, 0, 0.25, 0);          // держак
  const tip = new THREE.Mesh(
    new THREE.BoxGeometry(0.17, 0.17, 0.17),
    new THREE.MeshLambertMaterial({ color: 0xffd070, emissive: 0xff7a1a, emissiveIntensity: 1 })
  );
  tip.position.set(0, 0.54, 0);
  g.add(tip);
  const glowMat = new THREE.SpriteMaterial({
    map: torchGlowTex, transparent: true, depthWrite: false,
    blending: THREE.AdditiveBlending, opacity: 0.9,
  });
  const glow = new THREE.Sprite(glowMat);
  glow.scale.setScalar(1.3);
  glow.position.set(0, 0.54, 0);
  g.add(glow);
  return { group: g, tip, glow, mat: glowMat };
}

// Куди дивиться опора смолоскипа (клітинка, що його тримає)
function torchSupportCell(t) {
  if (t.face === 'floor') return [t.x, t.y - 1, t.z];
  return [t.x + t.dx, t.y, t.z + t.dz];
}

function torchKey(x, y, z) { return x + ',' + y + ',' + z; }

// Створити смолоскип у клітинці (x,y,z). face: 'floor' | 'wall'; для стіни
// dx/dz вказують на клітинку-опору. Повертає false, якщо не вдалося.
function addTorch(x, y, z, face, dx = 0, dz = 0) {
  const key = torchKey(x, y, z);
  if (torches.has(key) || torches.size >= TORCH_MAX) return false;
  const { group, tip, glow, mat } = makeTorchModel();
  group.position.set(x + 0.5, y, z + 0.5);
  if (face === 'wall') {
    // Притулити основу до стіни й нахилити полум'я назовні від неї
    group.position.x += dx * 0.28;
    group.position.z += dz * 0.28;
    group.position.y += 0.12;
    group.rotation.z = dx * 0.5;
    group.rotation.x = -dz * 0.5;
  }
  scene.add(group);
  torches.set(key, { x, y, z, face, dx, dz, group, tip, glow, mat, flick: Math.random() * 6.28, ember: Math.random() });
  return true;
}

function removeTorch(key) {
  const t = torches.get(key);
  if (!t) return;
  scene.remove(t.group);
  t.group.traverse((o) => {
    if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); }
    if (o.isSprite) o.material.dispose();
  });
  torches.delete(key);
}

// Зняти смолоскипи, що втратили опору або клітинку яких зайняв блок
function validateTorches() {
  if (torches.size === 0) return;
  for (const [key, t] of torches) {
    const [sx, sy, sz] = torchSupportCell(t);
    const occupied = isSolid(blockAt(t.x, t.y, t.z));
    const supported = isSolid(blockAt(sx, sy, sz));
    if (occupied || !supported) {
      spawnParticles(t.x + 0.5, t.y + 0.4, t.z + 0.5, torchEmber, 6,
        { radius: 0.2, speed: 1.2, upBias: 0.8, life: 0.5, size: 0.07, gravity: 8 });
      removeTorch(key);
    }
  }
}

// Чи є смолоскип у радіусі r від точки (для стримування спавну зомбі)
function torchNear(x, y, z, r) {
  if (torches.size === 0) return false;
  const r2 = r * r;
  for (const t of torches.values()) {
    const dx = t.x + 0.5 - x, dy = t.y + 0.5 - y, dz = t.z + 0.5 - z;
    if (dx * dx + dy * dy + dz * dz < r2) return true;
  }
  return false;
}

// Поставити смолоскип у клітинку перед прицілом (hit.prev), визначивши опору
function placeTorch(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR || torches.has(torchKey(x, y, z)) ||
      ladders.has(torchKey(x, y, z)) || doorAtCell(x, y, z) ||
      fences.has(torchKey(x, y, z)) || gates.has(torchKey(x, y, z)) ||
      saplings.has(torchKey(x, y, z))) return false;
  // Напрямок від клітинки смолоскипа до блока, по якому клікнули
  const sx = hit.block[0] - x, sy = hit.block[1] - y, sz = hit.block[2] - z;
  let ok = false;
  if (sy === -1 && sx === 0 && sz === 0) {
    ok = addTorch(x, y, z, 'floor');
  } else if (sy === 0 && (Math.abs(sx) + Math.abs(sz)) === 1) {
    ok = addTorch(x, y, z, 'wall', sx, sz);
  } else if (isSolid(blockAt(x, y - 1, z))) {
    // запасний варіант: підлога під клітинкою
    ok = addTorch(x, y, z, 'floor');
  }
  if (ok) {
    Sound.torch(0.16);
    spawnParticles(x + 0.5, y + 0.55, z + 0.5, torchEmber, 6,
      { radius: 0.15, speed: 1.4, upBias: 1.2, life: 0.5, size: 0.07, gravity: -2 });
    unlockAch('torch');
  }
  return ok;
}

const _torchSorted = [];
let torchCrackleTimer = 1.5;
function updateTorches(dt) {
  // Незалежне мерехтіння кожного полум'я
  for (const t of torches.values()) {
    t.flick += dt * (7 + Math.random() * 3);
    const f = 0.78 + 0.22 * Math.sin(t.flick) + (Math.random() - 0.5) * 0.08;
    t.tip.material.emissiveIntensity = 0.8 + f * 0.6;
    t.mat.opacity = 0.55 + f * 0.4;
    t.glow.scale.setScalar(1.15 + f * 0.35);
    // Зрідка злітає іскра вгору
    t.ember -= dt;
    if (t.ember <= 0) {
      t.ember = 0.5 + Math.random() * 1.2;
      const ey = t.y + 0.66 + (t.face === 'wall' ? 0.12 : 0);
      spawnParticles(t.x + 0.5, ey, t.z + 0.5, torchEmber, 1,
        { radius: 0.05, speed: 0.5, upBias: 0.9, life: 0.7, size: 0.05, gravity: -1.5 });
    }
  }

  // Призначити пул найближчих ламп
  if (torches.size > 0) {
    _torchSorted.length = 0;
    for (const t of torches.values()) {
      const dx = t.x + 0.5 - camera.position.x;
      const dy = t.y + 0.5 - camera.position.y;
      const dz = t.z + 0.5 - camera.position.z;
      const d2 = dx * dx + dy * dy + dz * dz;
      if (d2 < TORCH_LIGHT_RANGE * TORCH_LIGHT_RANGE) _torchSorted.push({ t, d2 });
    }
    _torchSorted.sort((a, b) => a.d2 - b.d2);
    for (let i = 0; i < TORCH_LIGHT_POOL; i++) {
      const l = torchLights[i];
      if (i < _torchSorted.length) {
        const t = _torchSorted[i].t;
        const flick = 0.85 + 0.15 * Math.sin(t.flick * 1.3);
        l.position.set(t.x + 0.5, t.y + 0.6, t.z + 0.5);
        l.intensity = 1.5 * flick;
      } else {
        l.intensity = 0;
      }
    }
    // Ледь чутне потріскування найближчого смолоскипа
    torchCrackleTimer -= dt;
    if (torchCrackleTimer <= 0) {
      torchCrackleTimer = 1.4 + Math.random() * 2.5;
      if (_torchSorted.length && _torchSorted[0].d2 < 64) Sound.torch(0.05);
    }
  } else {
    for (const l of torchLights) l.intensity = 0;
  }
}

// Відновити збережені смолоскипи (формат: [x, y, z, face, dx, dz])
if (savedGame && Array.isArray(savedGame.torches)) {
  for (const e of savedGame.torches) {
    if (Array.isArray(e) && e.length >= 4) addTorch(e[0], e[1], e[2], e[3], e[4] || 0, e[5] || 0);
  }
}

// ============================================================
// Драбини: вертикальне лазіння (окрема сутність, як смолоскипи)
// ============================================================
// Драбина чіпляється на бічну грань твердого блока (dx/dz вказують на опору)
// й не змінює воксельну сітку. Поки AABB гравця перетинає клітинку драбини,
// вмикається режим лазіння: W/Space — угору, Shift — униз, без клавіш —
// повільне сповзання; шкоди від падіння немає.
const ladders = new Map();             // "x,y,z" -> { x, y, z, dx, dz, group }
const LADDER_MAX = 512;                // межа, щоб збереження не розросталося
const LADDER_CLIMB_V = 3.2;            // швидкість лазіння, бл/с
const LADDER_SLIDE_V = -1.5;           // повільне сповзання без клавіш, бл/с
const LADDER_COLOR = new THREE.Color(0x9a6a33);

// Спільні ресурси моделі (геометрії/матеріал не дублюються на кожну драбину)
const LADDER_RAIL_GEO = new THREE.BoxGeometry(0.09, 1.0, 0.07);
const LADDER_RUNG_GEO = new THREE.BoxGeometry(0.56, 0.08, 0.05);
const LADDER_MAT = new THREE.MeshLambertMaterial({ color: 0x9a6a33 });

const ladderKey = (x, y, z) => x + ',' + y + ',' + z;

// Модель: дві вертикальні стійки + 4 щаблі у площині XY (нормаль +Z)
function makeLadderModel() {
  const g = new THREE.Group();
  for (const sx of [-0.32, 0.32]) {
    const rail = new THREE.Mesh(LADDER_RAIL_GEO, LADDER_MAT);
    rail.position.set(sx, 0.5, 0);
    g.add(rail);
  }
  for (const ry of [0.14, 0.38, 0.62, 0.86]) {
    const rung = new THREE.Mesh(LADDER_RUNG_GEO, LADDER_MAT);
    rung.position.set(0, ry, 0.01);
    g.add(rung);
  }
  return g;
}

// Створити драбину в клітинці (x,y,z); dx/dz вказують на блок-опору (стіну)
function addLadder(x, y, z, dx, dz) {
  const key = ladderKey(x, y, z);
  if (ladders.has(key) || ladders.size >= LADDER_MAX) return false;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return false;
  const group = makeLadderModel();
  group.position.set(x + 0.5 + dx * 0.42, y, z + 0.5 + dz * 0.42);
  group.rotation.y = Math.atan2(-dx, -dz);   // нормаль площини — від стіни
  scene.add(group);
  ladders.set(key, { x, y, z, dx, dz, group });
  return true;
}

function removeLadder(key) {
  const l = ladders.get(key);
  if (!l) return;
  scene.remove(l.group);
  ladders.delete(key);   // геометрія/матеріал спільні — не dispose
}

// Зняти драбини, що втратили опору або клітинку яких зайняв блок
function validateLadders() {
  if (ladders.size === 0) return;
  for (const [key, l] of ladders) {
    const occupied = isSolid(blockAt(l.x, l.y, l.z));
    const supported = isSolid(blockAt(l.x + l.dx, l.y, l.z + l.dz));
    if (occupied || !supported) {
      spawnParticles(l.x + 0.5, l.y + 0.5, l.z + 0.5, LADDER_COLOR, 6,
        { radius: 0.25, speed: 1.4, upBias: 0.4, life: 0.45, size: 0.09, gravity: 10 });
      removeLadder(key);
    }
  }
}

// Почепити драбину в клітинку перед прицілом (hit.prev) на бічну грань блока
function placeLadder(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (ladders.has(ladderKey(x, y, z)) || torches.has(x + ',' + y + ',' + z) ||
      crops.has(x + ',' + y + ',' + z) || beds.has(x + ',' + y + ',' + z) ||
      doorAtCell(x, y, z) || fences.has(ladderKey(x, y, z)) ||
      gates.has(ladderKey(x, y, z)) || saplings.has(ladderKey(x, y, z))) return false;
  // Напрямок від клітинки драбини до блока, по якому клікнули
  const sx = hit.block[0] - x, sy = hit.block[1] - y, sz = hit.block[2] - z;
  let ok = false;
  if (sy === 0 && Math.abs(sx) + Math.abs(sz) === 1) {
    ok = addLadder(x, y, z, sx, sz);
  } else {
    // Запасний варіант (клік по підлозі/стелі): будь-яка тверда сусідня стіна
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (isSolid(blockAt(x + dx, y, z + dz))) { ok = addLadder(x, y, z, dx, dz); break; }
    }
  }
  if (ok) {
    Sound.place(PLANK);
    spawnParticles(x + 0.5, y + 0.5, z + 0.5, LADDER_COLOR, 6,
      { radius: 0.3, speed: 1.3, upBias: 0.4, life: 0.4, size: 0.09, gravity: 10 });
  }
  return ok;
}

// Чи перетинає AABB гравця клітинку з драбиною (перевіряємо стовпчик клітинок
// центру: ноги, тулуб, голова)
function playerOnLadder() {
  if (ladders.size === 0) return false;
  const cx = Math.floor(player.pos.x), cz = Math.floor(player.pos.z);
  const y0 = Math.floor(player.pos.y);
  const y1 = Math.floor(player.pos.y + player.height * 0.55);
  const y2 = Math.floor(player.pos.y + player.height);
  return ladders.has(ladderKey(cx, y0, cz)) ||
         ladders.has(ladderKey(cx, y1, cz)) ||
         (y2 !== y1 && ladders.has(ladderKey(cx, y2, cz)));
}

// Відновити збережені драбини (формат: [x, y, z, dx, dz])
if (savedGame && Array.isArray(savedGame.ladders)) {
  for (const e of savedGame.ladders) {
    if (Array.isArray(e) && e.length >= 5) addLadder(e[0], e[1], e[2], e[3], e[4]);
  }
}

// ============================================================
// Двері: прохід, що відчиняється (окрема сутність, як драбини)
// ============================================================
// Двері займають колону з двох клітинок (ключ у мапі — нижня) й не належать
// воксельній сітці. Зачинена стулка — тверда перешкода для гравця, тварин і
// нечисті (через спільний moveEntityAxis), тож будинок із дверима захищає від
// зомбі вночі. ПКМ відчиняє/зачиняє (стулка плавно обертається на завісах),
// ЛКМ — знімає; стріли встромляються в зачинені двері.
const doors = new Map();               // "x,y,z" (нижня клітинка) -> { x, y, z, dx, dz, open, angle, group, pivot }
const DOOR_MAX = 128;                  // межа, щоб збереження не розросталося
const DOOR_SWING_V = 7;                // швидкість оберту стулки, рад/с
const DOOR_OPEN_ANGLE = Math.PI / 2;
const DOOR_COLOR = new THREE.Color(0x8a5a2b);

// Спільні ресурси моделі (геометрії/матеріали не дублюються на кожні двері)
const DOOR_PANEL_GEO = new THREE.BoxGeometry(0.92, 1.94, 0.11);
const DOOR_TRIM_GEO = new THREE.BoxGeometry(0.6, 0.5, 0.13);
const DOOR_WINDOW_GEO = new THREE.BoxGeometry(0.44, 0.34, 0.14);
const DOOR_KNOB_GEO = new THREE.BoxGeometry(0.07, 0.07, 0.16);
const DOOR_PANEL_MAT = new THREE.MeshLambertMaterial({ color: 0x8a5a2b });
const DOOR_TRIM_MAT = new THREE.MeshLambertMaterial({ color: 0x6b4a2b });
const DOOR_WINDOW_MAT = new THREE.MeshLambertMaterial({
  color: 0xbfe3ef, transparent: true, opacity: 0.55,
});
const DOOR_KNOB_MAT = new THREE.MeshLambertMaterial({ color: 0x3a2a16 });

const doorKey = (x, y, z) => x + ',' + y + ',' + z;

// Двері, чия колона накриває клітинку (нижня або верхня половина)
function doorAtCell(x, y, z) {
  if (doors.size === 0) return null;
  return doors.get(doorKey(x, y, z)) || doors.get(doorKey(x, y - 1, z)) || null;
}

// Чи блокують двері клітинку (зачинена стулка — тверда перешкода для колізій)
function doorBlocksCell(x, y, z) {
  if (doors.size === 0) return false;
  const d = doorAtCell(x, y, z);
  return !!d && !d.open;
}

// Модель: стулка (панель, фільонка, віконце й ручка) на півоті-«завісах».
// Стулка тягнеться від завіс у +X, тож оберт півота по Y відчиняє двері.
function makeDoorModel() {
  const pivot = new THREE.Group();
  const leaf = new THREE.Group();
  const panel = new THREE.Mesh(DOOR_PANEL_GEO, DOOR_PANEL_MAT);
  panel.position.set(0, 0.97, 0);
  leaf.add(panel);
  const trim = new THREE.Mesh(DOOR_TRIM_GEO, DOOR_TRIM_MAT);
  trim.position.set(0, 0.55, 0);
  leaf.add(trim);
  const glassPane = new THREE.Mesh(DOOR_WINDOW_GEO, DOOR_WINDOW_MAT);
  glassPane.position.set(0, 1.45, 0);
  leaf.add(glassPane);
  const knob = new THREE.Mesh(DOOR_KNOB_GEO, DOOR_KNOB_MAT);
  knob.position.set(0.36, 0.95, 0);
  leaf.add(knob);
  leaf.position.x = 0.46;   // центр панелі: стулка займає 0..0.92 від завіс
  pivot.add(leaf);
  return pivot;
}

// Створити двері з нижньою клітинкою (x,y,z); dx/dz — куди «дивиться» стулка
function addDoor(x, y, z, dx, dz, open = false) {
  const key = doorKey(x, y, z);
  if (doors.has(key) || doors.size >= DOOR_MAX) return null;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
  const group = new THREE.Group();
  const pivot = makeDoorModel();
  pivot.position.set(-0.46, 0.03, 0.38);   // завіси біля лівого краю, стулка при передній грані
  group.add(pivot);
  group.position.set(x + 0.5, y, z + 0.5);
  group.rotation.y = Math.atan2(dx, dz);   // локальний +Z — у напрямку dx/dz
  scene.add(group);
  const d = { x, y, z, dx, dz, open, angle: open ? DOOR_OPEN_ANGLE : 0, group, pivot };
  pivot.rotation.y = d.angle;
  doors.set(key, d);
  return d;
}

function removeDoor(key) {
  const d = doors.get(key);
  if (!d) return;
  scene.remove(d.group);
  doors.delete(key);   // геометрії/матеріали спільні — не dispose
}

// Зняти двері (ЛКМ або втрата опори): тріски + дерев'яний звук
function breakDoor(d) {
  spawnParticles(d.x + 0.5, d.y + 1, d.z + 0.5, DOOR_COLOR, 8,
    { radius: 0.3, speed: 1.6, upBias: 0.5, life: 0.5, size: 0.1, gravity: 10 });
  Sound.breakBlock(PLANK);
  removeDoor(doorKey(d.x, d.y, d.z));
}

// Прибрати двері, що втратили опору або чию колону зайняв блок
function validateDoors() {
  if (doors.size === 0) return;
  for (const d of doors.values()) {
    const occupied = isSolid(blockAt(d.x, d.y, d.z)) || isSolid(blockAt(d.x, d.y + 1, d.z));
    const supported = isSolid(blockAt(d.x, d.y - 1, d.z));
    if (occupied || !supported) breakDoor(d);
  }
}

// Чи перетинає AABB гравця/тварини/нечисті колону дверей — щоб не зачинити
// стулку на істоті (вона застрягла б у «твердій» клітинці)
function doorColumnBlockedByEntity(d) {
  const check = (e) => {
    const hw = e.halfW, hh = e.height;
    return e.pos.x + hw > d.x && e.pos.x - hw < d.x + 1 &&
           e.pos.y + hh > d.y && e.pos.y < d.y + 2 &&
           e.pos.z + hw > d.z && e.pos.z - hw < d.z + 1;
  };
  if (check(player)) return true;
  for (const m of mobs) if (check(m)) return true;
  for (const a of animals) if (check(a)) return true;
  return false;
}

// Відчинити/зачинити двері (ПКМ). Зачинити на комусь не вийде.
function toggleDoor(d) {
  if (d.open && doorColumnBlockedByEntity(d)) return false;
  d.open = !d.open;
  Sound.door(d.open);
  return true;
}

// Плавний оберт стулки до цільового кута
function updateDoors(dt) {
  if (doors.size === 0) return;
  for (const d of doors.values()) {
    const target = d.open ? DOOR_OPEN_ANGLE : 0;
    if (d.angle === target) continue;
    const step = DOOR_SWING_V * dt;
    d.angle = d.angle < target
      ? Math.min(target, d.angle + step)
      : Math.max(target, d.angle - step);
    d.pivot.rotation.y = d.angle;
  }
}

// Двері в прицілі: марш променем погляду по клітинках, поки не стріне двері
// чи твердий блок (двері не в воксельній сітці, тож raycastBlock їх не бачить)
const _doorDir = new THREE.Vector3();
function doorInSight(maxDist = 5) {
  if (doors.size === 0) return null;
  camera.getWorldDirection(_doorDir);
  for (let t = 0.1; t <= maxDist; t += 0.1) {
    const x = Math.floor(camera.position.x + _doorDir.x * t);
    const y = Math.floor(camera.position.y + _doorDir.y * t);
    const z = Math.floor(camera.position.z + _doorDir.z * t);
    const d = doorAtCell(x, y, z);
    if (d) return d;
    if (isSolid(blockAt(x, y, z))) return null;
  }
  return null;
}

// Поставити двері в клітинку перед прицілом (hit.prev) на тверду підлогу
function placeDoor(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR || blockAt(x, y + 1, z) !== AIR) return false;
  for (const cy of [y, y + 1]) {
    const k = doorKey(x, cy, z);
    if (doorAtCell(x, cy, z) || torches.has(k) || crops.has(k) ||
        beds.has(k) || ladders.has(k) || fences.has(k) || gates.has(k) ||
        saplings.has(k)) return false;
  }
  if (!isSolid(blockAt(x, y - 1, z))) return false;   // потрібна тверда підлога
  // Не ставити двері всередину гравця (колона з двох клітинок)
  const p = player.pos;
  if (x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W &&
      y + 2 > p.y && y < p.y + PLAYER_H &&
      z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W) return false;
  // Стулка «дивиться» на гравця: домінантна вісь напрямку двері → гравець
  const vx = p.x - (x + 0.5), vz = p.z - (z + 0.5);
  const dx = Math.abs(vx) >= Math.abs(vz) ? (Math.sign(vx) || 1) : 0;
  const dz = dx === 0 ? (Math.sign(vz) || 1) : 0;
  if (!addDoor(x, y, z, dx, dz)) return false;
  Sound.place(LOG);
  spawnParticles(x + 0.5, y + 1, z + 0.5, DOOR_COLOR, 8,
    { radius: 0.35, speed: 1.5, upBias: 0.4, life: 0.45, size: 0.1, gravity: 10 });
  unlockAch('homeowner');
  return true;
}

// Відновити збережені двері (формат: [x, y, z, dx, dz, open])
if (savedGame && Array.isArray(savedGame.doors)) {
  for (const e of savedGame.doors) {
    if (Array.isArray(e) && e.length >= 5) addDoor(e[0], e[1], e[2], e[3], e[4], e[5] === 1);
  }
}

// ============================================================
// Паркан і хвіртка: огорожа, яку не перестрибнути (сутності, як двері)
// ============================================================
// Паркан займає одну клітинку, але для колізій «високий»: блокує і клітинку
// над собою (огорожа «заввишки півтора блока»), тож гравець, тварини й нечисть
// не перестрибнуть — можна будувати загони для овець і безпечні двори. Секції
// з'єднуються перекладинами із сусідніми парканами, хвіртками та блоками.
// Хвіртка — стулка на завісах (ПКМ відчиняє/зачиняє), зачинена — така сама
// висока перешкода. Обоє не належать воксельній сітці; ЛКМ знімає.
const fences = new Map();              // "x,y,z" -> { x, y, z, group, arms }
const gates = new Map();               // "x,y,z" -> { x, y, z, dx, dz, open, angle, group, pivot }
const FENCE_MAX = 512;                 // межі, щоб збереження не розросталося
const GATE_MAX = 128;
const GATE_SWING_V = 7;                // швидкість оберту стулки, рад/с
const GATE_OPEN_ANGLE = Math.PI / 2;
const FENCE_COLOR = new THREE.Color(0xa9793f);

// Спільні ресурси моделей (геометрії/матеріали не дублюються на кожну секцію)
const FENCE_POST_GEO = new THREE.BoxGeometry(0.18, 1.0, 0.18);
const FENCE_RAIL_GEO = new THREE.BoxGeometry(0.1, 0.09, 0.5);   // плече до краю клітинки (+Z)
const FENCE_MAT = new THREE.MeshLambertMaterial({ color: 0xa9793f });
const FENCE_RAIL_MAT = new THREE.MeshLambertMaterial({ color: 0x8a5f2f });
const GATE_BAR_GEO = new THREE.BoxGeometry(0.92, 0.09, 0.1);
const GATE_END_GEO = new THREE.BoxGeometry(0.1, 0.72, 0.1);

const fenceKey = (x, y, z) => x + ',' + y + ',' + z;

// Чи стоїть у самій клітинці паркан або зачинена хвіртка (для стріл)
function fenceSolidAtCell(x, y, z) {
  if (fences.size > 0 && fences.has(fenceKey(x, y, z))) return true;
  if (gates.size > 0) {
    const g = gates.get(fenceKey(x, y, z));
    if (g && !g.open) return true;
  }
  return false;
}

// Чи блокує огорожа клітинку для колізій: паркан/зачинена хвіртка «високі» —
// накривають і клітинку над собою, тож перестрибнути не вийде
function fenceBlocksCell(x, y, z) {
  if (fences.size === 0 && gates.size === 0) return false;
  return fenceSolidAtCell(x, y, z) || fenceSolidAtCell(x, y - 1, z);
}

// Модель паркана: центральний стовпчик + 4 «плеча» з двох перекладин;
// видимість плеча вмикається, коли є з'єднання із сусідом
function makeFenceModel() {
  const group = new THREE.Group();
  const post = new THREE.Mesh(FENCE_POST_GEO, FENCE_MAT);
  post.position.y = 0.5;
  group.add(post);
  const arms = [];
  for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const arm = new THREE.Group();
    for (const ry of [0.78, 0.4]) {
      const rail = new THREE.Mesh(FENCE_RAIL_GEO, FENCE_RAIL_MAT);
      rail.position.set(0, ry, 0.25);
      arm.add(rail);
    }
    arm.rotation.y = Math.atan2(dx, dz);   // локальний +Z — у бік сусіда
    arm.visible = false;
    group.add(arm);
    arms.push({ dx, dz, arm });
  }
  return { group, arms };
}

// Плече паркана з'єднується із сусіднім парканом, хвірткою чи твердим блоком
function fenceLinksTo(x, y, z) {
  return fences.has(fenceKey(x, y, z)) || gates.has(fenceKey(x, y, z)) ||
         isSolid(blockAt(x, y, z));
}

function refreshFenceConnections() {
  for (const f of fences.values()) {
    for (const a of f.arms) a.arm.visible = fenceLinksTo(f.x + a.dx, f.y, f.z + a.dz);
  }
}

function addFence(x, y, z) {
  const key = fenceKey(x, y, z);
  if (fences.has(key) || fences.size >= FENCE_MAX) return false;
  const { group, arms } = makeFenceModel();
  group.position.set(x + 0.5, y, z + 0.5);
  scene.add(group);
  fences.set(key, { x, y, z, group, arms });
  refreshFenceConnections();
  return true;
}

function removeFence(key) {
  const f = fences.get(key);
  if (!f) return;
  scene.remove(f.group);
  fences.delete(key);   // геометрії/матеріали спільні — не dispose
  refreshFenceConnections();
}

// Зняти паркан (ЛКМ або втрата опори): тріски + дерев'яний звук
function breakFence(f) {
  spawnParticles(f.x + 0.5, f.y + 0.5, f.z + 0.5, FENCE_COLOR, 6,
    { radius: 0.25, speed: 1.5, upBias: 0.4, life: 0.45, size: 0.09, gravity: 10 });
  Sound.breakBlock(PLANK);
  removeFence(fenceKey(f.x, f.y, f.z));
}

// Модель хвіртки: стулка з двох перекладин і трьох брусів на півоті-«завісах»
// (як у дверей: стулка тягнеться від завіс у +X, оберт півота по Y відчиняє)
function makeGateModel() {
  const pivot = new THREE.Group();
  const leaf = new THREE.Group();
  for (const ry of [0.78, 0.4]) {
    const bar = new THREE.Mesh(GATE_BAR_GEO, FENCE_RAIL_MAT);
    bar.position.set(0, ry, 0);
    leaf.add(bar);
  }
  for (const bx of [-0.41, 0, 0.41]) {
    const end = new THREE.Mesh(GATE_END_GEO, FENCE_MAT);
    end.position.set(bx, 0.59, 0);
    leaf.add(end);
  }
  leaf.position.x = 0.46;   // центр стулки: вона займає 0..0.92 від завіс
  pivot.add(leaf);
  return pivot;
}

// Створити хвіртку в клітинці (x,y,z); dx/dz — куди «дивиться» стулка
function addGate(x, y, z, dx, dz, open = false) {
  const key = fenceKey(x, y, z);
  if (gates.has(key) || gates.size >= GATE_MAX) return null;
  if (Math.abs(dx) + Math.abs(dz) !== 1) return null;
  const group = new THREE.Group();
  for (const px of [-0.46, 0.46]) {      // нерухомі бічні стовпчики
    const post = new THREE.Mesh(FENCE_POST_GEO, FENCE_MAT);
    post.position.set(px, 0.5, 0);
    group.add(post);
  }
  const pivot = makeGateModel();
  pivot.position.set(-0.46, 0, 0);       // завіси біля лівого стовпчика
  group.add(pivot);
  group.position.set(x + 0.5, y, z + 0.5);
  group.rotation.y = Math.atan2(dx, dz); // локальний +Z — у напрямку dx/dz
  scene.add(group);
  const g = { x, y, z, dx, dz, open, angle: open ? GATE_OPEN_ANGLE : 0, group, pivot };
  pivot.rotation.y = g.angle;
  gates.set(key, g);
  refreshFenceConnections();
  return g;
}

function removeGate(key) {
  const g = gates.get(key);
  if (!g) return;
  scene.remove(g.group);
  gates.delete(key);   // геометрії/матеріали спільні — не dispose
  refreshFenceConnections();
}

function breakGate(g) {
  spawnParticles(g.x + 0.5, g.y + 0.5, g.z + 0.5, FENCE_COLOR, 6,
    { radius: 0.25, speed: 1.5, upBias: 0.4, life: 0.45, size: 0.09, gravity: 10 });
  Sound.breakBlock(PLANK);
  removeGate(fenceKey(g.x, g.y, g.z));
}

// Прибрати паркани/хвіртки, що втратили опору або чию клітинку зайняв блок
function validateFences() {
  if (fences.size === 0 && gates.size === 0) return;
  for (const f of fences.values()) {
    if (isSolid(blockAt(f.x, f.y, f.z)) || !isSolid(blockAt(f.x, f.y - 1, f.z))) breakFence(f);
  }
  for (const g of gates.values()) {
    if (isSolid(blockAt(g.x, g.y, g.z)) || !isSolid(blockAt(g.x, g.y - 1, g.z))) breakGate(g);
  }
  refreshFenceConnections();   // сусідні блоки могли з'явитися чи зникнути
}

// Чи перетинає AABB істоти «високу» колону хвіртки — щоб не зачинити на комусь
function gateColumnBlockedByEntity(g) {
  const check = (e) => {
    const hw = e.halfW, hh = e.height;
    return e.pos.x + hw > g.x && e.pos.x - hw < g.x + 1 &&
           e.pos.y + hh > g.y && e.pos.y < g.y + 2 &&
           e.pos.z + hw > g.z && e.pos.z - hw < g.z + 1;
  };
  if (check(player)) return true;
  for (const m of mobs) if (check(m)) return true;
  for (const a of animals) if (check(a)) return true;
  return false;
}

// Відчинити/зачинити хвіртку (ПКМ). Зачинити на комусь не вийде.
function toggleGate(g) {
  if (g.open && gateColumnBlockedByEntity(g)) return false;
  g.open = !g.open;
  Sound.door(g.open);
  return true;
}

// Плавний оберт стулки до цільового кута
function updateGates(dt) {
  if (gates.size === 0) return;
  for (const g of gates.values()) {
    const target = g.open ? GATE_OPEN_ANGLE : 0;
    if (g.angle === target) continue;
    const step = GATE_SWING_V * dt;
    g.angle = g.angle < target
      ? Math.min(target, g.angle + step)
      : Math.max(target, g.angle - step);
    g.pivot.rotation.y = g.angle;
  }
}

// Паркан чи хвіртка в прицілі: марш променем погляду по клітинках (сутності
// не в воксельній сітці, тож raycastBlock їх не бачить)
const _fenceDir = new THREE.Vector3();
function fenceOrGateInSight(maxDist = 5) {
  if (fences.size === 0 && gates.size === 0) return null;
  camera.getWorldDirection(_fenceDir);
  for (let t = 0.1; t <= maxDist; t += 0.1) {
    const x = Math.floor(camera.position.x + _fenceDir.x * t);
    const y = Math.floor(camera.position.y + _fenceDir.y * t);
    const z = Math.floor(camera.position.z + _fenceDir.z * t);
    const f = fences.get(fenceKey(x, y, z));
    if (f) return { fence: f };
    const g = gates.get(fenceKey(x, y, z));
    if (g) return { gate: g };
    if (isSolid(blockAt(x, y, z))) return null;
  }
  return null;
}

// Клітинка вільна від інших сутностей-предметів (спільна перевірка встановлення)
function fenceCellFree(x, y, z) {
  const k = fenceKey(x, y, z);
  return !fences.has(k) && !gates.has(k) && !doorAtCell(x, y, z) &&
         !torches.has(k) && !crops.has(k) && !beds.has(k) && !ladders.has(k) &&
         !saplings.has(k);
}

// Не ставити огорожу всередину гравця (колізія накриває і клітинку вище)
function fenceOverlapsPlayer(x, y, z) {
  const p = player.pos;
  return x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W &&
         y + 2 > p.y && y < p.y + PLAYER_H &&
         z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W;
}

// Поставити паркан у клітинку перед прицілом (hit.prev) на тверду опору
function placeFence(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (!fenceCellFree(x, y, z)) return false;
  if (!isSolid(blockAt(x, y - 1, z))) return false;   // потрібна тверда опора
  if (fenceOverlapsPlayer(x, y, z)) return false;
  if (!addFence(x, y, z)) return false;
  Sound.place(PLANK);
  spawnParticles(x + 0.5, y + 0.5, z + 0.5, FENCE_COLOR, 6,
    { radius: 0.3, speed: 1.4, upBias: 0.4, life: 0.4, size: 0.09, gravity: 10 });
  unlockAch('fence');
  return true;
}

// Поставити хвіртку: стулка «дивиться» на гравця (як двері)
function placeGate(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (!fenceCellFree(x, y, z)) return false;
  if (!isSolid(blockAt(x, y - 1, z))) return false;   // потрібна тверда опора
  if (fenceOverlapsPlayer(x, y, z)) return false;
  const p = player.pos;
  const vx = p.x - (x + 0.5), vz = p.z - (z + 0.5);
  const dx = Math.abs(vx) >= Math.abs(vz) ? (Math.sign(vx) || 1) : 0;
  const dz = dx === 0 ? (Math.sign(vz) || 1) : 0;
  if (!addGate(x, y, z, dx, dz)) return false;
  Sound.place(PLANK);
  spawnParticles(x + 0.5, y + 0.5, z + 0.5, FENCE_COLOR, 6,
    { radius: 0.3, speed: 1.4, upBias: 0.4, life: 0.4, size: 0.09, gravity: 10 });
  unlockAch('fence');
  return true;
}

// Відновити збережені паркани (формат: [x, y, z]) і хвіртки ([x, y, z, dx, dz, open])
if (savedGame && Array.isArray(savedGame.fences)) {
  for (const e of savedGame.fences) {
    if (Array.isArray(e) && e.length >= 3) addFence(e[0], e[1], e[2]);
  }
}
if (savedGame && Array.isArray(savedGame.gates)) {
  for (const e of savedGame.gates) {
    if (Array.isArray(e) && e.length >= 5) addGate(e[0], e[1], e[2], e[3], e[4], e[5] === 1);
  }
}

// ============================================================
// Землеробство: грядки та посіви (окрема сутність, як смолоскипи)
// ============================================================
const crops = new Map();               // "x,y,z" -> { x, y, z, stage, growth, group, mat, phase }
const CROP_MAX = 512;                   // межа, щоб збереження не розросталося
const CROP_STAGES = 5;                  // 0..4; 4 — дозрілий колос
const CROP_GROW_TIME = 11;              // секунд на стадію за повного сонця
const WHEAT_FOOD = 2;                   // скільки їжі дає зібраний дозрілий колос
const CROP_HEIGHTS = [0.22, 0.4, 0.58, 0.78, 0.96]; // висота моделі на кожній стадії
const cropSupportable = (id) => id === GRASS || id === DIRT;
const cropKey = (x, y, z) => x + ',' + y + ',' + z;

// П'ять процедурних текстур стадій (паросток → золотий колос), без атласу
const cropTextures = [];
function makeCropTextures() {
  const blades = [3, 4, 5, 6, 7];
  const heights = [4, 7, 10, 13, 15];
  for (let s = 0; s < CROP_STAGES; s++) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = TILE;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    const ripe = s / (CROP_STAGES - 1);
    const r = Math.round(95 + ripe * 120);   // зелений → золотий
    const g = Math.round(174 - ripe * 44);
    const b = Math.round(62 - ripe * 24);
    const n = blades[s], h = heights[s];
    for (let i = 0; i < n; i++) {
      const x = Math.round(1 + (i + 0.5) * (TILE - 2) / n);
      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(x, TILE - h, 1, h);                 // стебло
      if (h > 5) ctx.fillRect(x - 1, TILE - h + 3, 1, 2); // листочок
      if (s >= CROP_STAGES - 2) {                      // золота голівка-колос
        ctx.fillStyle = `rgb(${Math.min(255, r + 46)},${g + 34},${Math.max(0, b)})`;
        ctx.fillRect(x - 1, TILE - h, 3, 3);
      }
    }
    const tex = new THREE.CanvasTexture(cv);
    tex.magFilter = THREE.NearestFilter;
    tex.minFilter = THREE.NearestFilter;
    cropTextures.push(tex);
  }
}
makeCropTextures();

// Спільна геометрія: дві перпендикулярні площини (хрест), основа в y=0
const CROP_PLANE = new THREE.PlaneGeometry(0.9, 1);
CROP_PLANE.translate(0, 0.5, 0);

function makeCropModel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    map: cropTextures[0], alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  const p1 = new THREE.Mesh(CROP_PLANE, mat);
  const p2 = new THREE.Mesh(CROP_PLANE, mat);
  p2.rotation.y = Math.PI / 2;
  g.add(p1, p2);
  return { group: g, mat };
}

function applyCropStage(c) {
  c.group.scale.y = CROP_HEIGHTS[c.stage];
  c.mat.map = cropTextures[c.stage];
  c.mat.needsUpdate = true;
}

function addCrop(x, y, z, stage = 0, growth = 0) {
  const key = cropKey(x, y, z);
  if (crops.has(key) || crops.size >= CROP_MAX) return false;
  const { group, mat } = makeCropModel();
  group.position.set(x + 0.5, y, z + 0.5);
  scene.add(group);
  const c = { x, y, z, stage: 0, growth: 0, group, mat, phase: Math.random() * 6.28 };
  c.stage = THREE.MathUtils.clamp(Math.floor(stage), 0, CROP_STAGES - 1);
  c.growth = Math.max(0, growth) || 0;
  applyCropStage(c);
  crops.set(key, c);
  return true;
}

function removeCrop(key) {
  const c = crops.get(key);
  if (!c) return;
  scene.remove(c.group);
  c.mat.dispose();           // геометрія CROP_PLANE спільна — не чіпаємо
  crops.delete(key);
}

// Зняти посіви, що втратили опору (траву/землю) або клітинку яких зайняв блок
function validateCrops() {
  if (crops.size === 0) return;
  for (const [key, c] of crops) {
    const occupied = isSolid(blockAt(c.x, c.y, c.z));
    const supported = cropSupportable(blockAt(c.x, c.y - 1, c.z));
    if (occupied || !supported) {
      spawnParticles(c.x + 0.5, c.y + 0.3, c.z + 0.5, new THREE.Color(0x6cae3e), 6,
        { radius: 0.25, speed: 1.6, upBias: 0.8, life: 0.5, size: 0.08, gravity: 8 });
      removeCrop(key);
    }
  }
}

// Посадити насіння в клітинку перед прицілом (hit.prev) на траву/землю
function plantCrop(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (crops.has(cropKey(x, y, z)) || torches.has(torchKey(x, y, z)) ||
      ladders.has(cropKey(x, y, z)) || doorAtCell(x, y, z) ||
      fences.has(cropKey(x, y, z)) || gates.has(cropKey(x, y, z)) ||
      saplings.has(cropKey(x, y, z))) return false;
  if (!cropSupportable(blockAt(x, y - 1, z))) return false;  // лише на грунті
  if (!addCrop(x, y, z)) return false;
  Sound.dig(GRASS);                                          // м'який звук грунту
  spawnParticles(x + 0.5, y + 0.06, z + 0.5, new THREE.Color(0x6b4a2b), 7,
    { radius: 0.3, speed: 1.5, upBias: 0.5, life: 0.45, size: 0.09, gravity: 10 });
  unlockAch('plant');
  return true;
}

function harvestCrop(c) {
  const mature = c.stage >= CROP_STAGES - 1;
  const color = new THREE.Color(mature ? 0xe7c45a : 0x6cae3e);
  spawnParticles(c.x + 0.5, c.y + 0.4, c.z + 0.5, color, mature ? 12 : 6,
    { radius: 0.3, speed: 2.2, upBias: 1.0, life: 0.6, size: 0.1, gravity: 6 });
  Sound.breakBlock(LEAVES);                                  // шелест
  if (mature) {
    player.food = Math.min(FOOD_MAX, player.food + WHEAT_FOOD);
    updateFoodHud();
    unlockAch('harvest');
  }
  removeCrop(cropKey(c.x, c.y, c.z));
}

let cropClock = 0;
function updateCrops(dt) {
  if (crops.size === 0) return;
  cropClock += dt;
  for (const c of crops.values()) {
    // Легке погойдування під «вітром»
    c.group.rotation.z = Math.sin(cropClock * 1.5 + c.phase) * 0.05;
    if (c.stage >= CROP_STAGES - 1) continue;
    // Світло: денне сонце (приглушене негодою); вночі трохи живить смолоскип
    let light = Math.max(0, dayNightSun) * (1 - weatherDark * 0.5);
    if (light < 0.25 && torchNear(c.x + 0.5, c.y + 0.5, c.z + 0.5, 7)) {
      light = Math.max(light, 0.5);
    }
    if (light <= 0.02) continue;
    c.growth += dt * light;
    if (c.growth >= CROP_GROW_TIME) {
      c.growth = 0;
      c.stage++;
      applyCropStage(c);
      spawnParticles(c.x + 0.5, c.y + CROP_HEIGHTS[c.stage] * 0.6, c.z + 0.5,
        new THREE.Color(0x9cd25a), 4,
        { radius: 0.18, speed: 1.0, upBias: 1.0, life: 0.5, size: 0.06, gravity: -1 });
    }
  }
}

// Відновити збережені посіви (формат: [x, y, z, stage, growth])
if (savedGame && Array.isArray(savedGame.crops)) {
  for (const e of savedGame.crops) {
    if (Array.isArray(e) && e.length >= 3) addCrop(e[0], e[1], e[2], e[3] || 0, e[4] || 0);
  }
}

// ============================================================
// Саджанці: виростити справжнє воксельне дерево
// ============================================================
// Саджанець — окрема сутність (як посів): садиться ПКМ на траву/землю, росте
// від світла (сонце; вночі трохи живить смолоскип) і, назбиравши зросту,
// перетворюється на справжнє дерево у воксельній сітці — тієї самої форми, що
// й згенеровані. Якщо стовбуру тісно (блоки чи гравець на заваді) — саджанець
// терпляче чекає вільного місця й пробує знову.
const saplings = new Map();            // "x,y,z" -> { x, y, z, growth, group, mat, phase }
const SAPLING_MAX = 256;               // межа, щоб збереження не розросталося
const SAPLING_GROW_TIME = 50;          // секунд росту за повного сонця
const saplingKey = (x, y, z) => x + ',' + y + ',' + z;

// Одна процедурна текстура: стовбурець і зелена крона (без атласу)
const saplingTexture = (() => {
  const cv = document.createElement('canvas');
  cv.width = cv.height = TILE;
  const ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, TILE, TILE);
  ctx.fillStyle = '#7a5230';
  ctx.fillRect(7, 8, 2, 8);            // стовбурець
  ctx.fillStyle = '#3e7d2c';
  ctx.fillRect(4, 3, 8, 6);            // крона
  ctx.fillRect(6, 1, 4, 2);
  ctx.fillStyle = '#569e3d';
  ctx.fillRect(5, 4, 3, 2);            // світлі відблиски листя
  ctx.fillRect(9, 6, 2, 2);
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  return tex;
})();

function makeSaplingModel() {
  const g = new THREE.Group();
  const mat = new THREE.MeshLambertMaterial({
    map: saplingTexture, alphaTest: 0.45,
    side: THREE.DoubleSide,
  });
  const p1 = new THREE.Mesh(CROP_PLANE, mat);
  const p2 = new THREE.Mesh(CROP_PLANE, mat);
  p2.rotation.y = Math.PI / 2;
  g.add(p1, p2);
  return { group: g, mat };
}

// Паросток помітно тягнеться вгору й ушир у міру росту
function applySaplingGrowth(s) {
  const t = Math.min(1, s.growth / SAPLING_GROW_TIME);
  s.group.scale.y = 0.45 + t * 0.5;
  s.group.scale.x = s.group.scale.z = 0.8 + t * 0.2;
}

function addSapling(x, y, z, growth = 0) {
  const key = saplingKey(x, y, z);
  if (saplings.has(key) || saplings.size >= SAPLING_MAX) return false;
  const { group, mat } = makeSaplingModel();
  group.position.set(x + 0.5, y, z + 0.5);
  scene.add(group);
  const s = { x, y, z, growth: Math.max(0, growth) || 0, group, mat, phase: Math.random() * 6.28 };
  applySaplingGrowth(s);
  saplings.set(key, s);
  return true;
}

function removeSapling(key) {
  const s = saplings.get(key);
  if (!s) return;
  scene.remove(s.group);
  s.mat.dispose();           // геометрія CROP_PLANE спільна — не чіпаємо
  saplings.delete(key);
}

// Зняти саджанці, що втратили опору (траву/землю) або клітинку яких зайняв блок
function validateSaplings() {
  if (saplings.size === 0) return;
  for (const [key, s] of saplings) {
    const occupied = isSolid(blockAt(s.x, s.y, s.z));
    const supported = cropSupportable(blockAt(s.x, s.y - 1, s.z));
    if (occupied || !supported) {
      spawnParticles(s.x + 0.5, s.y + 0.3, s.z + 0.5, new THREE.Color(0x3e7d2c), 6,
        { radius: 0.25, speed: 1.6, upBias: 0.8, life: 0.5, size: 0.08, gravity: 8 });
      removeSapling(key);
    }
  }
}

// Посадити саджанець у клітинку перед прицілом (hit.prev) на траву/землю
function plantSapling(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (saplings.has(saplingKey(x, y, z)) || crops.has(cropKey(x, y, z)) ||
      torches.has(torchKey(x, y, z)) || ladders.has(saplingKey(x, y, z)) ||
      beds.has(saplingKey(x, y, z)) || doorAtCell(x, y, z) ||
      fences.has(saplingKey(x, y, z)) || gates.has(saplingKey(x, y, z))) return false;
  if (!cropSupportable(blockAt(x, y - 1, z))) return false;  // лише на грунті
  if (!addSapling(x, y, z)) return false;
  Sound.dig(GRASS);                                          // м'який звук грунту
  spawnParticles(x + 0.5, y + 0.06, z + 0.5, new THREE.Color(0x6b4a2b), 7,
    { radius: 0.3, speed: 1.5, upBias: 0.5, life: 0.45, size: 0.09, gravity: 10 });
  return true;
}

// Виростити справжнє дерево на місці саджанця: стовбур з колод + крона з листя
// (та сама форма, що в genChunkData). Стовбуру потрібні вільні клітинки —
// інакше ріст відкладається і саджанець спробує знову за кілька секунд.
function growSaplingTree(s) {
  const { x, y, z } = s;
  const trunkH = 4 + Math.floor(Math.random() * 2);        // 4..5, як у генерації
  if (y + trunkH + 1 >= HEIGHT) return false;
  for (let dy = 0; dy < trunkH; dy++) {
    if (blockAt(x, y + dy, z) !== AIR) return false;       // стовбуру тісно
  }
  // Не рости крізь гравця (стовбур — колона твердих блоків)
  const p = player.pos;
  if (x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W &&
      y + trunkH > p.y && y < p.y + PLAYER_H &&
      z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W) return false;
  removeSapling(saplingKey(x, y, z));
  // Крона — лише у вільні клітинки (як onlyAir у генерації)
  for (let dy = trunkH - 2; dy <= trunkH + 1; dy++) {
    const r = dy <= trunkH - 1 ? 2 : 1;
    for (let ox = -r; ox <= r; ox++) {
      for (let oz = -r; oz <= r; oz++) {
        if (Math.abs(ox) === r && Math.abs(oz) === r && r === 2) continue;
        if (blockAt(x + ox, y + dy, z + oz) === AIR) setBlock(x + ox, y + dy, z + oz, LEAVES);
      }
    }
  }
  // Стовбур
  for (let dy = 0; dy < trunkH; dy++) setBlock(x, y + dy, z, LOG);
  Sound.place(LOG);
  spawnParticles(x + 0.5, y + trunkH * 0.6, z + 0.5, new THREE.Color(0x4d8f35), 16,
    { radius: 1.2, speed: 2.2, upBias: 1.0, life: 0.7, size: 0.12, gravity: 4 });
  // Нові блоки могли зайняти клітинки сутностей поряд (смолоскипи, інші саджанці...)
  validateTorches();
  validateCrops();
  validateBeds();
  validateLadders();
  validateDoors();
  validateFences();
  validateSaplings();
  unlockAch('grow_tree');
  return true;
}

let saplingClock = 0;
function updateSaplings(dt) {
  if (saplings.size === 0) return;
  saplingClock += dt;
  for (const s of saplings.values()) {
    // Легке погойдування під «вітром»
    s.group.rotation.z = Math.sin(saplingClock * 1.5 + s.phase) * 0.04;
    // Світло: денне сонце (приглушене негодою); вночі трохи живить смолоскип
    let light = Math.max(0, dayNightSun) * (1 - weatherDark * 0.5);
    if (light < 0.25 && torchNear(s.x + 0.5, s.y + 0.5, s.z + 0.5, 7)) {
      light = Math.max(light, 0.5);
    }
    if (light <= 0.02) continue;
    s.growth += dt * light;
    applySaplingGrowth(s);
    if (s.growth >= SAPLING_GROW_TIME && !growSaplingTree(s)) {
      s.growth = SAPLING_GROW_TIME * 0.8;   // тісно — почекати й спробувати ще
    }
  }
}

// Відновити збережені саджанці (формат: [x, y, z, growth])
if (savedGame && Array.isArray(savedGame.saplings)) {
  for (const e of savedGame.saplings) {
    if (Array.isArray(e) && e.length >= 3) addSapling(e[0], e[1], e[2], e[3] || 0);
  }
}

// ============================================================
// Ліжка: проспати ніч до світанку й закріпити точку відродження
// ============================================================
// Ліжко — окрема сутність (як смолоскип/посів): ставиться на тверду опору й не
// належить воксельній сітці. Подивившись на нього (ПКМ) уночі та без монстрів
// поряд, гравець «засинає»: екран тьмяніє, час перескакує до світанку (нічна
// нечисть на сонці згоряє) і ліжко стає точкою відродження.
const beds = new Map();                 // "x,y,z" -> { x, y, z, yaw, group }
const BED_MAX = 64;                     // межа, щоб збереження не розросталося
const bedKey = (x, y, z) => x + ',' + y + ',' + z;

// Процедурна модель ліжка в межах однієї клітинки (нуль зовнішніх ассетів):
// 4 ніжки + дерев'яний каркас, червоний матрац і біла подушка з боку голови.
function makeBedModel() {
  const g = new THREE.Group();
  const wood = 0x6b4a2b, red = 0xb53a2e, white = 0xe8e4dc, dark = 0x4a3219;
  for (const [lx, lz] of [[-0.38, -0.38], [0.38, -0.38], [-0.38, 0.38], [0.38, 0.38]]) {
    animalBox(g, 0.14, 0.16, 0.14, dark, lx, 0.08, lz);       // ніжки по кутах
  }
  animalBox(g, 0.94, 0.12, 0.94, wood, 0, 0.22, 0);           // каркас
  animalBox(g, 0.86, 0.16, 0.86, red, 0, 0.36, 0);            // матрац
  animalBox(g, 0.66, 0.12, 0.30, white, 0, 0.50, -0.30);      // подушка (бік голови, −Z)
  return g;
}

function addBed(x, y, z, yaw = 0) {
  const key = bedKey(x, y, z);
  if (beds.has(key) || beds.size >= BED_MAX) return false;
  const group = makeBedModel();
  group.position.set(x + 0.5, y, z + 0.5);
  group.rotation.y = yaw;
  scene.add(group);
  beds.set(key, { x, y, z, yaw, group });
  return true;
}

function removeBed(key) {
  const b = beds.get(key);
  if (!b) return;
  scene.remove(b.group);
  b.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  beds.delete(key);
}

// Прибрати ліжка, що втратили опору або клітинку яких зайняв блок
function validateBeds() {
  if (beds.size === 0) return;
  for (const [key, b] of beds) {
    const occupied = isSolid(blockAt(b.x, b.y, b.z));
    const supported = isSolid(blockAt(b.x, b.y - 1, b.z));
    if (occupied || !supported) {
      spawnParticles(b.x + 0.5, b.y + 0.3, b.z + 0.5, new THREE.Color(0xb53a2e), 7,
        { radius: 0.3, speed: 1.6, upBias: 0.7, life: 0.5, size: 0.09, gravity: 9 });
      removeBed(key);
    }
  }
}

// Поставити ліжко у клітинку перед прицілом (hit.prev) на тверду опору
function placeBed(hit) {
  const [x, y, z] = hit.prev;
  if (blockAt(x, y, z) !== AIR) return false;
  if (beds.has(bedKey(x, y, z)) || torches.has(torchKey(x, y, z)) ||
      crops.has(cropKey(x, y, z)) || ladders.has(bedKey(x, y, z)) ||
      doorAtCell(x, y, z) || fences.has(bedKey(x, y, z)) ||
      gates.has(bedKey(x, y, z)) || saplings.has(bedKey(x, y, z))) return false;
  if (!isSolid(blockAt(x, y - 1, z))) return false;           // потрібна тверда підлога
  // Не ставити ліжко всередину гравця
  const p = player.pos;
  if (x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W &&
      y + 1 > p.y && y < p.y + PLAYER_H &&
      z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W) return false;
  const yaw = Math.round(player.yaw / (Math.PI / 2)) * (Math.PI / 2);  // повернути за поглядом
  if (!addBed(x, y, z, yaw)) return false;
  Sound.place(PLANK);
  spawnParticles(x + 0.5, y + 0.3, z + 0.5, blockColor(PLANK), 6,
    { radius: 0.4, speed: 1.4, upBias: 0.3, life: 0.4, size: 0.1, gravity: 9 });
  return true;
}

// ===== Сон =====
let sleeping = false;
let sleepT = 0;
let sleepJumped = false;
const SLEEP_FADE = 0.5;                  // тривалість затемнення/прояснення
const SLEEP_HOLD = 0.3;                  // пауза в темряві
const SLEEP_WAKE = DAY_LENGTH * 0.05;    // мить пробудження (світанок)

// Достатньо темно, щоб спати (той самий поріг, що й спавн нічної нечисті)
const canSleepNow = () => dayNightSun <= -0.05;
// Чи поряд (у радіусі r) є вороже мобі — тоді не заснути
const monstersNear = (r) => mobs.some((m) => m.pos.distanceTo(player.pos) < r);

// Затемнення на час сну + короткий текст-підказка (створюються в JS — без правок HTML)
const sleepOverlay = document.createElement('div');
sleepOverlay.style.cssText =
  'position:fixed;inset:0;background:#000;opacity:0;pointer-events:none;z-index:40;display:none';
document.body.appendChild(sleepOverlay);
const sleepMsg = document.createElement('div');
sleepMsg.style.cssText =
  'position:fixed;left:50%;bottom:42%;transform:translateX(-50%);max-width:80%;' +
  'color:#fff;font:600 18px system-ui,Arial,sans-serif;text-align:center;' +
  'text-shadow:0 1px 4px #000;opacity:0;pointer-events:none;z-index:41;transition:opacity .3s';
document.body.appendChild(sleepMsg);
let sleepMsgTimer = 0;
function sleepToast(msg) {
  sleepMsg.textContent = msg;
  sleepMsg.style.opacity = '1';
  sleepMsgTimer = 1.6;
}

// Спроба заснути в ліжку. Повертає true, якщо сон почався.
function trySleep(bed) {
  if (sleeping || player.dead || !bed) return false;
  if (!canSleepNow()) { sleepToast('Спати можна лише вночі'); return false; }
  if (monstersNear(8)) { sleepToast('Поряд монстри — не заснути'); return false; }
  sleeping = true;
  sleepT = 0;
  sleepJumped = false;
  dismountHorse();   // спати верхи не вийде — злізти біля ліжка
  mining = false;
  cancelBowDraw();
  spawnPoint = { x: bed.x, z: bed.z };   // закріпити точку відродження біля ліжка
  sleepMsg.style.opacity = '0';
  return true;
}

function updateSleep(dt) {
  if (sleepMsgTimer > 0) {
    sleepMsgTimer -= dt;
    if (sleepMsgTimer <= 0) sleepMsg.style.opacity = '0';
  }
  if (!sleeping) return;
  sleepT += dt;
  let op;
  if (sleepT < SLEEP_FADE) {
    op = sleepT / SLEEP_FADE;                                  // затемнення
  } else if (sleepT < SLEEP_FADE + SLEEP_HOLD) {
    op = 1;
    if (!sleepJumped) {                                        // у пітьмі — проспати ніч
      sleepJumped = true;
      timeOfDay = SLEEP_WAKE;
      player.sinceHurt = 999;                                  // дозволити регенерацію після сну
      player.air = MAX_AIR;
      if (player.hunger >= 6 && player.health < MAX_HEALTH) {  // легкий «відпочилий» бонус
        player.health = Math.min(MAX_HEALTH, player.health + 4);
      }
      unlockAch('sleep');
      saveGame();
    }
  } else if (sleepT < SLEEP_FADE * 2 + SLEEP_HOLD) {
    op = 1 - (sleepT - SLEEP_FADE - SLEEP_HOLD) / SLEEP_FADE;  // прояснення
  } else {
    op = 0;
    sleeping = false;
  }
  sleepOverlay.style.opacity = op.toFixed(3);
  sleepOverlay.style.display = (sleeping || op > 0) ? 'block' : 'none';
}

// Відновити збережені ліжка (формат: [x, y, z, yaw])
if (savedGame && Array.isArray(savedGame.beds)) {
  for (const e of savedGame.beds) {
    if (Array.isArray(e) && e.length >= 3) addBed(e[0], e[1], e[2], e[3] || 0);
  }
}

// ===== Поетапний видобуток =====
let mining = false;                       // утримується кнопка руйнування
const miningState = { key: null, progress: 0 };
let digSoundTimer = 0;                     // ритм «цокання» киркою під час видобутку

function resetMining() {
  miningState.key = null;
  miningState.progress = 0;
  crackMesh.visible = false;
}

function updateMining(dt, hit) {
  if (!mining || !hit) {
    resetMining();
    digSoundTimer = 0;
    return;
  }
  const [x, y, z] = hit.block;
  const id = blockAt(x, y, z);

  // Динаміт підпалюється одним ударом, а не видобувається
  if (id === TNT) {
    igniteTnt(x, y, z);
    triggerSwing();
    mining = false;
    resetMining();
    return;
  }

  triggerSwing(); // безперервний мах киркою

  const key = x + ',' + y + ',' + z;
  if (key !== miningState.key) {
    miningState.key = key;
    miningState.progress = 0;
  }
  const hardness = BLOCK_HARDNESS[id] ?? DEFAULT_HARDNESS;
  miningState.progress += dt / hardness;

  // Ритмічне «цокання» киркою по блоку
  digSoundTimer -= dt;
  if (digSoundTimer <= 0) {
    Sound.dig(id);
    digSoundTimer = 0.22;
  }

  if (miningState.progress >= 1) {
    spawnParticles(x + 0.5, y + 0.5, z + 0.5, blockColor(id), 14,
      { radius: 0.45, speed: 3.5, upBias: 1.5, life: 0.7, size: 0.13 });
    Sound.breakBlock(id);
    setBlock(x, y, z, AIR);
    validateTorches();  // міг зникнути блок-опора смолоскипа
    validateCrops();    // ... або грунт під посівом
    validateBeds();     // ... або опора під ліжком
    validateLadders();  // ... або стіна-опора драбини
    validateDoors();    // ... або опора під дверима
    validateFences();   // ... або опора під парканом/хвірткою
    validateSaplings(); // ... або грунт під саджанцем
    unlockAch('first_block');
    if (id === LOG) unlockAch('chop_wood');
    else if (id === COAL) unlockAch('coal');
    else if (id === IRON) unlockAch('iron');
    else if (id === GOLD) unlockAch('gold');
    else if (id === DIAMOND) unlockAch('diamond');
    resetMining();
    return;
  }

  // Показати тріщини відповідної стадії
  const stage = Math.min(CRACK_STAGES - 1, Math.floor(miningState.progress * CRACK_STAGES));
  crackTexture.offset.x = stage / CRACK_STAGES;
  crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  crackMesh.visible = true;
}

// ============================================================
// Човни: плавзасіб для подорожі водою
// ============================================================
// Човен — окрема сутність (модель із коробок + власна фізика), а не воксельний
// блок: він не змінює сітку чанка. Спливає на поверхні води (проста плавучість),
// а на суходолі підкоряється гравітації. Гравець сідає в нього і кермує поглядом
// (W — вперед, S — назад), пливучи помітно швидше, ніж уплав. Колізії з рельєфом
// — через спільний moveEntityAxis. Стан зберігається зі світом (сумісно зі
// старими сейвами — поле необов'язкове).
const boats = [];
const BOAT_MAX = 16;            // межа, щоб збереження не розросталося
const BOAT_HALF = 0.42;         // піврозмір колізійної коробки (вужче за клітинку)
const BOAT_H = 0.36;            // висота коробки
const BOAT_SEAT = 0.34;         // підйом «сидіння» над центром човна (для камери)
const BOAT_FLOAT = 0.9;         // де тримати центр човна відносно клітинки води (ватерлінія)
const BOAT_MAXV = 6.4;          // макс. горизонтальна швидкість (швидше за уплав)
const BOAT_ACCEL = 15;          // прискорення від весел
const BOAT_DRAG = 2.6;          // опір води (згасання швидкості)
let ridingBoat = null;          // човен, у якому зараз пливе гравець (або null)

function makeBoatModel() {
  const g = new THREE.Group();
  const wood = 0x8a5a2b, dark = 0x6b4a2b, plank = 0xa9793f;
  animalBox(g, 1.0, 0.14, 1.5, dark, 0, 0.06, 0);          // днище
  animalBox(g, 0.12, 0.24, 1.5, wood, -0.5, 0.20, 0);      // лівий борт
  animalBox(g, 0.12, 0.24, 1.5, wood, 0.5, 0.20, 0);       // правий борт
  animalBox(g, 1.0, 0.24, 0.14, wood, 0, 0.20, -0.72);     // ніс (−Z, «вперед»)
  animalBox(g, 1.0, 0.24, 0.14, wood, 0, 0.20, 0.72);      // корма
  animalBox(g, 0.7, 0.1, 0.42, plank, 0, 0.24, 0.1);       // сидіння
  return g;
}

function addBoat(x, y, z, yaw = 0) {
  if (boats.length >= BOAT_MAX) return null;
  const group = makeBoatModel();
  group.position.set(x, y, z);
  group.rotation.y = yaw;
  scene.add(group);
  const boat = {
    pos: new THREE.Vector3(x, y, z),
    vel: new THREE.Vector3(),
    yaw, group, halfW: BOAT_HALF, height: BOAT_H, onGround: false, bob: 0,
  };
  boats.push(boat);
  return boat;
}

function removeBoat(boat) {
  const i = boats.indexOf(boat);
  if (i < 0) return;
  if (ridingBoat === boat) ridingBoat = null;
  scene.remove(boat.group);
  boat.group.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  boats.splice(i, 1);
}

// Знайти рівень поверхні води під/над центром човна (верхня клітинка води в
// невеликому вікні). Повертає цільову висоту центру для плавучості або null,
// якщо води поряд немає (тоді працює гравітація).
function boatWaterSurface(boat) {
  const fx = Math.floor(boat.pos.x), fz = Math.floor(boat.pos.z);
  const top = Math.floor(boat.pos.y) + 2;
  for (let y = top; y >= top - 5; y--) {
    if (isWaterId(blockAt(fx, y, fz))) return y + BOAT_FLOAT;
  }
  return null;
}

// Вертикальна фізика човна: плавучість до ватерлінії у воді, інакше гравітація.
function boatVertical(boat, dt) {
  const surf = boatWaterSurface(boat);
  if (surf !== null) {
    boat.vel.y += (surf - boat.pos.y) * 9 * dt;   // пружина до поверхні
    boat.vel.y *= Math.max(0, 1 - 6 * dt);        // сильне згасання (не розгойдувати)
    boat.vel.y = THREE.MathUtils.clamp(boat.vel.y, -4, 4);
  } else {
    boat.vel.y = Math.max(boat.vel.y - 22 * dt, -30);
  }
  boat.onGround = false;
  moveEntityAxis(boat, 'y', boat.vel.y * dt);
}

// Знайти точку встановлення човна вздовж погляду: перша клітинка води (спливе на
// поверхні) або верх твердої поверхні. Повертає { x, y, z, water } або null.
function boatPlacement() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const start = camera.position.clone();
  const step = 0.06;
  let prev = null;
  for (let t = 0; t < 6; t += step) {
    const p = start.clone().addScaledVector(dir, t);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    if (prev && bx === prev[0] && by === prev[1] && bz === prev[2]) continue;
    const id = blockAt(bx, by, bz);
    if (isWaterId(id)) return { x: bx + 0.5, y: by + BOAT_FLOAT, z: bz + 0.5, water: true };
    if (isSolid(id)) {
      if (!prev) return null;
      return { x: prev[0] + 0.5, y: prev[1] + BOAT_H, z: prev[2] + 0.5, water: false };
    }
    prev = [bx, by, bz];
  }
  return null;
}

function placeBoat() {
  if (boats.length >= BOAT_MAX) return false;
  const spot = boatPlacement();
  if (!spot) return false;
  const boat = addBoat(spot.x, spot.y, spot.z, player.yaw);
  if (!boat) return false;
  Sound.splash();
  spawnParticles(spot.x, spot.y, spot.z, blockColor(WATER), 8,
    { radius: 0.4, speed: 1.5, upBias: 0.5, life: 0.4, size: 0.08, gravity: 8 });
  return true;
}

// Найближчий човен у радіусі r від гравця (для посадки).
function nearestBoat(r = 2.8) {
  let best = null, bestD = r * r;
  for (const b of boats) {
    const d = b.pos.distanceToSquared(player.pos);
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

function mountBoat(boat) {
  // Верхи на коні в човен не сісти (як і навпаки) — інакше обидва «сідла»
  // тягли б гравця одночасно
  if (!boat || ridingBoat || ridingHorse) return false;
  ridingBoat = boat;
  boat.vel.set(0, 0, 0);
  mining = false;
  cancelBowDraw();
  player.vel.set(0, 0, 0);
  player.flying = false;
  unlockAch('sailor');
  Sound.splash();
  return true;
}

// Спроба сісти в човен, на який дивимось/поряд якого стоїмо. Повертає true, якщо сів.
function tryMountBoat() {
  if (ridingBoat) return false;
  const boat = nearestBoat();
  return boat ? mountBoat(boat) : false;
}

function dismountBoat(reposition = true) {
  if (!ridingBoat) return;
  const b = ridingBoat;
  ridingBoat = null;
  b.vel.x = 0; b.vel.z = 0;
  if (reposition) {
    player.pos.set(b.pos.x, b.pos.y + 0.7, b.pos.z);  // виринути над човном
    player.vel.set(0, 0, 0);
    player.fallPeakY = player.pos.y;
    player.prevOnGround = false;
  }
}

// Кермування човном, у якому пливе гравець (викликається з updatePlayer).
function driveBoat(dt) {
  const boat = ridingBoat;
  boat.yaw = player.yaw;                         // ніс повертається за поглядом

  let thrust = 0;
  if (keys['KeyW']) thrust += 1;
  if (keys['KeyS']) thrust -= 0.6;
  if (joy.active) thrust += -joy.y;              // сенсор: вперед по джойстику
  thrust = THREE.MathUtils.clamp(thrust, -0.6, 1);

  const fwdx = -Math.sin(player.yaw), fwdz = -Math.cos(player.yaw);
  boat.vel.x += fwdx * thrust * BOAT_ACCEL * dt;
  boat.vel.z += fwdz * thrust * BOAT_ACCEL * dt;
  const drag = Math.max(0, 1 - BOAT_DRAG * dt);
  boat.vel.x *= drag;
  boat.vel.z *= drag;
  const sp = Math.hypot(boat.vel.x, boat.vel.z);
  if (sp > BOAT_MAXV) { boat.vel.x *= BOAT_MAXV / sp; boat.vel.z *= BOAT_MAXV / sp; }

  boatVertical(boat, dt);
  moveEntityAxis(boat, 'x', boat.vel.x * dt);
  moveEntityAxis(boat, 'z', boat.vel.z * dt);
  boat.group.position.set(boat.pos.x, boat.pos.y, boat.pos.z);

  // Гравець «прив'язаний» до сидіння — без власної фізики й шкоди від падіння
  player.pos.set(boat.pos.x, boat.pos.y + BOAT_SEAT, boat.pos.z);
  player.vel.set(0, 0, 0);
  player.onGround = true;
  player.fallPeakY = player.pos.y;

  // Провалилися під світ (баг рельєфу) — злізти, щоб не застрягти
  if (boat.pos.y < -8) dismountBoat(false);
}

// Оновлення вільних (некерованих) човнів: плавучість, згасання дрейфу, гойдання.
function updateBoats(dt) {
  for (let i = boats.length - 1; i >= 0; i--) {
    const boat = boats[i];
    if (boat === ridingBoat) { boat.group.rotation.y = boat.yaw; continue; }
    if (boat.pos.y < -10) { removeBoat(boat); continue; }
    boatVertical(boat, dt);
    const drag = Math.max(0, 1 - 3 * dt);
    boat.vel.x *= drag; boat.vel.z *= drag;
    if (Math.abs(boat.vel.x) > 0.001) moveEntityAxis(boat, 'x', boat.vel.x * dt);
    if (Math.abs(boat.vel.z) > 0.001) moveEntityAxis(boat, 'z', boat.vel.z * dt);
    boat.bob += dt;
    const onWater = boatWaterSurface(boat) !== null;
    boat.group.position.set(boat.pos.x, boat.pos.y + (onWater ? Math.sin(boat.bob * 1.6) * 0.03 : 0), boat.pos.z);
    boat.group.rotation.y = boat.yaw;
    boat.group.rotation.z = onWater ? Math.sin(boat.bob * 1.2) * 0.03 : 0;
  }
}

// Відновити збережені човни (сумісно зі старими сейвами — поле необов'язкове)
if (savedGame && Array.isArray(savedGame.boats)) {
  for (const e of savedGame.boats) {
    if (Array.isArray(e) && e.length >= 3 && e.slice(0, 3).every(Number.isFinite)) {
      addBoat(e[0], e[1], e[2], Number.isFinite(e[3]) ? e[3] : 0);
    }
  }
}

// ============================================================
// Відро: перенесення джерел води й лави
// ============================================================
// Порожнє відро набирає перше джерело (WATER/LAVA), у яке дивиться гравець,
// і стає повним; повне виливає це джерело на націлену клітинку (як ставлять
// блок), запускаючи звичайну симуляцію потоку через setBlock. У воксельну
// сітку відро не потрапляє — змінюється лише id у слоті хотбара.
const BUCKET_RANGE = 6;

// Знайти першу клітинку-джерело флюїду вздовж погляду (потоки пропускаємо —
// набрати можна лише вічне джерело, як у Minecraft).
function findFluidSource() {
  const dir = new THREE.Vector3();
  camera.getWorldDirection(dir);
  const start = camera.position.clone();
  const step = 0.05;
  for (let t = 0; t < BUCKET_RANGE; t += step) {
    const p = start.clone().addScaledVector(dir, t);
    const bx = Math.floor(p.x), by = Math.floor(p.y), bz = Math.floor(p.z);
    const id = blockAt(bx, by, bz);
    if (id === WATER || id === LAVA) return { x: bx, y: by, z: bz, id };
    if (isSolid(id)) return null;   // тверда перешкода — далі джерела не дістати
  }
  return null;
}

function useBucket() {
  const held = hotbar[selectedSlot];

  if (held === BUCKET) {
    // Порожнє відро — набрати найближче джерело води чи лави
    const src = findFluidSource();
    if (!src) return;
    setBlock(src.x, src.y, src.z, AIR);   // прибрати джерело (сусідні потоки висохнуть)
    const water = src.id === WATER;
    assignBlockToSlot(water ? WATER_BUCKET : LAVA_BUCKET);
    triggerSwing();
    if (water) Sound.splash(); else Sound.lava();
    spawnParticles(src.x + 0.5, src.y + 0.5, src.z + 0.5, blockColor(src.id), 8,
      { radius: 0.3, speed: 1.5, upBias: 0.7, life: 0.4, size: 0.07, gravity: 8 });
    unlockAch('bucket');
    return;
  }

  // Повне відро — вилити джерело на націлену клітинку (порожнє повітря чи флюїд)
  const hit = raycastBlock();
  if (!hit || !hit.prev) return;
  const [x, y, z] = hit.prev;
  if (isSolid(blockAt(x, y, z))) return;   // лити можна лише в повітря або флюїд

  // Не лити всередину гравця
  const p = player.pos;
  const overlapX = x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W;
  const overlapY = y + 1 > p.y && y < p.y + PLAYER_H;
  const overlapZ = z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W;
  if (overlapX && overlapY && overlapZ) return;

  const fluid = held === WATER_BUCKET ? WATER : LAVA;
  setBlock(x, y, z, fluid);   // джерело — setBlock запускає симуляцію потоку
  assignBlockToSlot(BUCKET);
  triggerSwing();
  if (fluid === WATER) Sound.splash(); else Sound.lava();
  spawnParticles(x + 0.5, y + 0.5, z + 0.5, blockColor(fluid), 8,
    { radius: 0.35, speed: 1.5, upBias: 0.5, life: 0.4, size: 0.08, gravity: 8 });
  unlockAch('bucket');
}

function placeBlock() {
  triggerSwing();

  // Човен поряд (ПКМ) → сісти в нього, з будь-яким предметом у руці. Робимо це
  // до raycast, бо над відкритою водою промінь може не знайти твердого блока.
  if (boats.length > 0 && tryMountBoat()) return;
  // Човен у руці — спустити його на воду чи землю перед прицілом
  if (hotbar[selectedSlot] === BOAT) { placeBoat(); return; }

  // Вовк у прицілі (ПКМ) → погодувати/приручити м'ясом або посадити прирученого
  if (animals.length > 0 && tryInteractWolf()) return;

  // Кінь у прицілі (ПКМ) → погодувати/приручити їжею або сісти верхи
  if (animals.length > 0 && tryInteractHorse()) return;

  // Двері в прицілі (ПКМ) → відчинити/зачинити, з будь-яким предметом у руці.
  // До raycast, бо двері не в воксельній сітці й промінь їх не бачить.
  if (doors.size > 0) {
    const d = doorInSight();
    if (d) { toggleDoor(d); return; }
  }

  // Хвіртка в прицілі (ПКМ) → відчинити/зачинити, з будь-яким предметом у руці
  if (gates.size > 0) {
    const fg = fenceOrGateInSight();
    if (fg && fg.gate) { toggleGate(fg.gate); return; }
  }

  const hit = raycastBlock();
  if (!hit || !hit.prev) return;

  // Сон має пріоритет: дивимось на ліжко (ПКМ) → лягти спати (з будь-яким предметом)
  if (beds.size > 0) {
    const bk = bedKey(hit.prev[0], hit.prev[1], hit.prev[2]);
    if (beds.has(bk)) { trySleep(beds.get(bk)); return; }
  }

  if (hotbar[selectedSlot] === BOW) return;   // луком не ставлять блок
  if (hotbar[selectedSlot] === ROD) return;   // вудкою теж не ставлять блок

  // Відро — особливий предмет: порожнім набирає джерело флюїду, повним — виливає
  if (isBucket(hotbar[selectedSlot])) { useBucket(); return; }

  const id = hotbar[selectedSlot];

  // Смолоскип — особлива сутність: ставиться на опору, не змінює воксельну сітку
  if (id === TORCH) {
    placeTorch(hit);
    return;
  }

  // Драбина — сутність на бічній грані блока, не змінює воксельну сітку
  if (id === LADDER) {
    placeLadder(hit);
    return;
  }

  // Двері — сутність на дві клітинки заввишки, не змінює воксельну сітку
  if (id === DOOR) {
    placeDoor(hit);
    return;
  }

  // Паркан і хвіртка — сутності-огорожа, не змінюють воксельну сітку
  if (id === FENCE) {
    placeFence(hit);
    return;
  }
  if (id === GATE) {
    placeGate(hit);
    return;
  }

  // Насіння — сутність-посів: садиться на траву/землю, не змінює воксельну сітку
  if (id === SEEDS) {
    plantCrop(hit);
    return;
  }

  // Саджанець — сутність-паросток: садиться на траву/землю й виростає в дерево
  if (id === SAPLING) {
    plantSapling(hit);
    return;
  }

  // Ліжко — особлива сутність: ставиться на тверду опору, не змінює воксельну сітку
  if (id === BED) {
    placeBed(hit);
    return;
  }

  const [x, y, z] = hit.prev;
  const target = blockAt(x, y, z);
  if (target !== AIR && !isFluid(target)) return;   // можна ставити в повітря, воду чи лаву

  // Не ставити блок усередину гравця
  const p = player.pos;
  const overlapX = x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W;
  const overlapY = y + 1 > p.y && y < p.y + PLAYER_H;
  const overlapZ = z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W;
  if (overlapX && overlapY && overlapZ) return;

  setBlock(x, y, z, id);
  Sound.place(id);
  unlockAch('place_block');
  if (id === GLASS) unlockAch('glazier');
  // Невеликий пил при встановленні блока
  spawnParticles(x + 0.5, y + 0.5, z + 0.5, blockColor(id), 6,
    { radius: 0.5, speed: 1.4, upBias: 0.3, life: 0.4, size: 0.1, gravity: 10 });
  validateTorches();  // блок міг зайняти клітинку смолоскипа
  validateCrops();    // ... або клітинку посіву
  validateBeds();     // ... або клітинку ліжка
  validateLadders();  // ... або клітинку драбини
  validateDoors();    // ... або клітинку дверей
  validateFences();   // ... або клітинку паркана/хвіртки
  validateSaplings(); // ... або клітинку саджанця
}

// ===== Менеджмент чанків =====
let meshQueue = [];

function updateChunks() {
  const pcx = Math.floor(player.pos.x / CHUNK);
  const pcz = Math.floor(player.pos.z / CHUNK);

  // Прибрати далекі чанки
  for (const [key, entry] of chunkMeshes) {
    const [cx, cz] = key.split(',').map(Number);
    if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > RENDER_DIST + 1) {
      disposeChunkMesh(entry, scene);
      chunkMeshes.delete(key);
    }
  }
  for (const key of chunkData.keys()) {
    const [cx, cz] = key.split(',').map(Number);
    if (Math.max(Math.abs(cx - pcx), Math.abs(cz - pcz)) > RENDER_DIST + 3) {
      chunkData.delete(key);
    }
  }

  // Запланувати нові
  meshQueue = [];
  for (let dx = -RENDER_DIST; dx <= RENDER_DIST; dx++) {
    for (let dz = -RENDER_DIST; dz <= RENDER_DIST; dz++) {
      const cx = pcx + dx, cz = pcz + dz;
      if (!chunkMeshes.has(chunkKey(cx, cz))) {
        meshQueue.push([cx, cz, dx * dx + dz * dz]);
      }
    }
  }
  meshQueue.sort((a, b) => a[2] - b[2]);
}

function processChunkQueue() {
  // Перебудувати змінені чанки одразу
  for (const key of dirtyChunks) {
    const entry = chunkMeshes.get(key);
    if (entry) {
      disposeChunkMesh(entry, scene);
      const [cx, cz] = key.split(',').map(Number);
      chunkMeshes.set(key, buildChunkMesh(cx, cz, scene, materials));
    }
  }
  dirtyChunks.clear();

  // Будувати до 2 нових чанків за кадр
  let built = 0;
  while (meshQueue.length > 0 && built < 2) {
    const [cx, cz] = meshQueue.shift();
    const key = chunkKey(cx, cz);
    if (!chunkMeshes.has(key)) {
      chunkMeshes.set(key, buildChunkMesh(cx, cz, scene, materials));
      built++;
    }
  }
}

// ============================================================
// Небесні тіла: сонце, місяць і зорі
// ============================================================
// Малюються окремою сценою на нескінченній «небесній сфері» (камера в центрі,
// без туману), тому видно весь час незалежно від дальності промальовування.
const skyScene = new THREE.Scene();
const skyCamera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.1, 4000);
const SKY_R = 1500;

// М'який радіальний градієнт для світіння сонця/місяця
function makeGlowTexture(inner, mid) {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, inner);
  g.addColorStop(0.45, mid);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Місяць: бліде ядро з кратерами та м'яким гало
function makeMoonTexture() {
  const s = 128, c = s / 2;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  // гало
  const halo = ctx.createRadialGradient(c, c, s * 0.28, c, c, c);
  halo.addColorStop(0, 'rgba(214,224,240,0.55)');
  halo.addColorStop(1, 'rgba(214,224,240,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, s, s);
  // диск
  ctx.beginPath();
  ctx.arc(c, c, s * 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#e9eef7';
  ctx.fill();
  // кратери
  ctx.fillStyle = 'rgba(150,162,186,0.55)';
  const craters = [[-8, -6, 5], [10, 4, 6], [2, 12, 4], [-4, 10, 3], [12, -10, 3]];
  for (const [dx, dy, r] of craters) {
    ctx.beginPath();
    ctx.arc(c + dx, c + dy, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const sunSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeGlowTexture('rgba(255,250,235,1)', 'rgba(255,221,140,0.55)'),
  transparent: true, depthTest: false, depthWrite: false, fog: false,
  blending: THREE.AdditiveBlending,
}));
sunSprite.scale.setScalar(220);
skyScene.add(sunSprite);

const moonSprite = new THREE.Sprite(new THREE.SpriteMaterial({
  map: makeMoonTexture(),
  transparent: true, depthTest: false, depthWrite: false, fog: false,
}));
moonSprite.scale.setScalar(150);
skyScene.add(moonSprite);

// Зорі: випадкові точки на сфері, обертаються разом із небом
function makeStarTexture() {
  const s = 32;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,0.6)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  return new THREE.CanvasTexture(cv);
}

const STAR_COUNT = 1400;
const starGroup = new THREE.Group();
{
  const pos = new Float32Array(STAR_COUNT * 3);
  for (let n = 0; n < STAR_COUNT; n++) {
    // рівномірно по всій сфері (ті, що під обрієм, просто не видно)
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const r = Math.sqrt(1 - u * u);
    pos[n * 3] = r * Math.cos(phi) * SKY_R * 0.95;
    pos[n * 3 + 1] = u * SKY_R * 0.95;
    pos[n * 3 + 2] = r * Math.sin(phi) * SKY_R * 0.95;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: makeStarTexture(),
    size: 22,
    sizeAttenuation: true,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    fog: false,
    blending: THREE.AdditiveBlending,
    opacity: 0,
  });
  starGroup.add(new THREE.Points(geo, mat));
  starGroup.userData.material = mat;
}
skyScene.add(starGroup);

const _sunDir = new THREE.Vector3();
const sunsetColor = new THREE.Color(0xff8a4a);

// ===== Хмари: м'які білборди, що дрейфують по небосхилу =====
// Малюються тим самим небесним проходом, що й сонце/місяць/зорі (без туману,
// нескінченно далеко). Текстура процедурна — жодних зовнішніх ассетів.
function makeCloudTexture() {
  const s = 128;
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const ctx = cv.getContext('2d');
  // кілька накладених м'яких кружків утворюють пухнасту хмару з прозорими краями
  const blobs = [
    [0.50, 0.56, 0.30], [0.33, 0.60, 0.20], [0.67, 0.60, 0.22],
    [0.43, 0.50, 0.18], [0.59, 0.50, 0.18], [0.50, 0.66, 0.16],
  ];
  for (const [cx, cy, r] of blobs) {
    const g = ctx.createRadialGradient(cx * s, cy * s, 0, cx * s, cy * s, r * s);
    g.addColorStop(0, 'rgba(255,255,255,0.85)');
    g.addColorStop(0.6, 'rgba(255,255,255,0.45)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const CLOUD_COUNT = 18;
const cloudGroup = new THREE.Group();
// Спільний матеріал для всіх хмар — тон/прозорість оновлюються один раз за кадр
const cloudMat = new THREE.SpriteMaterial({
  map: makeCloudTexture(),
  transparent: true, depthTest: false, depthWrite: false, fog: false,
  opacity: 0.85,
});
const cloudDayColor = new THREE.Color(0xffffff);
const cloudNightColor = new THREE.Color(0x2b3551);
const _cloudColor = new THREE.Color();
{
  let s = 1234567;
  const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  const R = SKY_R * 0.9;
  for (let n = 0; n < CLOUD_COUNT; n++) {
    const spr = new THREE.Sprite(cloudMat);
    // рівномірно по азимуту, елевація 10°..44° над обрієм
    const az = rnd() * Math.PI * 2;
    const el = (10 + rnd() * 34) * Math.PI / 180;
    const horiz = Math.cos(el) * R;
    spr.position.set(Math.cos(az) * horiz, Math.sin(el) * R, Math.sin(az) * horiz);
    const sc = 260 + rnd() * 280;
    spr.scale.set(sc * 1.7, sc, 1); // хмари широкі та пласкі
    cloudGroup.add(spr);
  }
}
skyScene.add(cloudGroup);

// ============================================================
// Погода: дощ, сніг і грози — процедурні, зав'язані на хмари/світло/звук
// ============================================================
// Опади малюються одним InstancedMesh у головній сцені (з туманом і перевіркою
// глибини, тож краплі за рельєфом природно приховані). Жодних зовнішніх ассетів:
// дощ — це тонкі сині штрихи, сніг — м'які білі сніжинки, що погойдуються.
const WEATHER_R = 14;          // радіус «колони» опадів навколо гравця
const PRECIP_MAX = 520;        // розмір пулу крапель/сніжинок
const SNOW_LINE = SEA + 16;    // вище за цей рівень — холодно, падає сніг
const FOG_FAR = RENDER_DIST * CHUNK;

const _savedW = savedGame?.weather;
const _isWeather = (s) => s === 'rain' || s === 'snow' || s === 'clear';
let weatherState = _isWeather(_savedW?.state) ? _savedW.state : 'clear';
let weatherTimer = Number.isFinite(_savedW?.timer) ? _savedW.timer : 12 + Math.random() * 25;
let weatherIntensity = Number.isFinite(_savedW?.intensity)
  ? THREE.MathUtils.clamp(_savedW.intensity, 0, 1) : 0;
let weatherDark = 0;           // затемнення світла/неба від негоди
let skyFlash = 0;              // спалах блискавки (0..1, швидко згасає)
let lightningTimer = 6 + Math.random() * 14;

const stormGrey = new THREE.Color(0x3a3f47);
const flashColor = new THREE.Color(0xdfe8ff);

const precipMat = new THREE.MeshBasicMaterial({
  color: 0x9fb4cc, transparent: true, opacity: 0.5, fog: true, depthWrite: false,
});
const precipMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), precipMat, PRECIP_MAX);
precipMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
precipMesh.frustumCulled = false;
precipMesh.visible = false;
scene.add(precipMesh);

const drops = [];
for (let i = 0; i < PRECIP_MAX; i++) drops.push({ x: 0, y: -9999, z: 0, sway: Math.random() * 6.28 });
let dropsSeeded = false;

const _wMat = new THREE.Matrix4();
const _wPos = new THREE.Vector3();
const _wQuat = new THREE.Quaternion();
const _wScale = new THREE.Vector3();
const _wHidden = new THREE.Matrix4().makeScale(0, 0, 0);

// Чи відкрите небо просто над гравцем (у печері/під дахом опадів немає)
function skyIsOpenAbove() {
  const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z);
  for (let y = Math.ceil(player.pos.y + EYE); y < HEIGHT; y++) {
    if (isSolid(blockAt(x, y, z))) return false;
  }
  return true;
}

// Зміна погоди: з «ясно» — шанс негоди (дощ унизу / сніг високо), з негоди — до ясного
function pickWeather() {
  if (weatherState === 'clear') {
    if (Math.random() < 0.55) {
      weatherState = player.pos.y >= SNOW_LINE ? 'snow' : 'rain';
      weatherTimer = 30 + Math.random() * 70;
      lightningTimer = 6 + Math.random() * 14;
    } else {
      weatherTimer = 40 + Math.random() * 80;
    }
  } else {
    weatherState = 'clear';
    weatherTimer = 50 + Math.random() * 110;
  }
}

function updateWeather(dt) {
  weatherTimer -= dt;
  if (weatherTimer <= 0) pickWeather();

  const exposed = skyIsOpenAbove();
  const isSnow = weatherState === 'snow';
  const target = (weatherState === 'clear' || !exposed) ? 0 : 1;
  weatherIntensity += (target - weatherIntensity) * Math.min(1, dt * 0.6);
  if (weatherIntensity < 0.001) weatherIntensity = 0;
  weatherDark = weatherIntensity * (isSnow ? 0.28 : 0.5);

  // Ambient-звук дощу (сніг беззвучний)
  Sound.setRain(weatherState === 'rain' ? weatherIntensity : 0);

  // Блискавка під час сильного дощу під відкритим небом
  if (weatherState === 'rain' && exposed && weatherIntensity > 0.5) {
    lightningTimer -= dt;
    if (lightningTimer <= 0) {
      skyFlash = 1;
      lightningTimer = 10 + Math.random() * 18;
      setTimeout(() => Sound.thunder(), 400 + Math.random() * 2200);
    }
  }
  if (skyFlash > 0) skyFlash = Math.max(0, skyFlash - dt * 5);

  if (weatherIntensity <= 0) {
    if (precipMesh.visible) precipMesh.visible = false;
    dropsSeeded = false;
    return;
  }
  precipMesh.visible = true;
  precipMat.color.setHex(isSnow ? 0xffffff : 0x9fb4cc);
  precipMat.opacity = isSnow ? 0.85 : 0.5;
  if (isSnow) _wScale.set(0.09, 0.09, 0.09);
  else _wScale.set(0.035, 0.55, 0.035);

  const top = player.pos.y + 16;
  const bottom = player.pos.y - 6;
  if (!dropsSeeded) {
    for (const d of drops) {
      d.x = player.pos.x + (Math.random() * 2 - 1) * WEATHER_R;
      d.z = player.pos.z + (Math.random() * 2 - 1) * WEATHER_R;
      d.y = bottom + Math.random() * (top - bottom);
    }
    dropsSeeded = true;
  }

  const fall = isSnow ? 3.2 : 24;
  const wind = isSnow ? 1.2 : 3.5;
  const active = Math.floor(PRECIP_MAX * weatherIntensity);
  for (let i = 0; i < PRECIP_MAX; i++) {
    if (i >= active) { precipMesh.setMatrixAt(i, _wHidden); continue; }
    const d = drops[i];
    d.y -= fall * dt;
    if (isSnow) {
      d.sway += dt * 2;
      d.x += Math.sin(d.sway) * wind * dt;
      d.z += Math.cos(d.sway * 0.7) * wind * dt;
    } else {
      d.x += wind * dt * 0.4;
    }
    // Переробка: краплі впала нижче колони або гравець відійшов убік
    if (d.y < bottom ||
        Math.abs(d.x - player.pos.x) > WEATHER_R ||
        Math.abs(d.z - player.pos.z) > WEATHER_R) {
      d.x = player.pos.x + (Math.random() * 2 - 1) * WEATHER_R;
      d.z = player.pos.z + (Math.random() * 2 - 1) * WEATHER_R;
      d.y = top - Math.random() * 4;
    }
    _wPos.set(d.x, d.y, d.z);
    _wMat.compose(_wPos, _wQuat, _wScale);
    precipMesh.setMatrixAt(i, _wMat);
  }
  precipMesh.instanceMatrix.needsUpdate = true;
}

// ===== День / ніч =====
const dayColor = new THREE.Color(0x87ceeb);
const nightColor = new THREE.Color(0x0b1026);
const skyColor = new THREE.Color();
let timeOfDay = Number.isFinite(savedGame?.timeOfDay)
  ? savedGame.timeOfDay
  : DAY_LENGTH * 0.25; // почати вранці

function updateDayNight(dt) {
  timeOfDay = (timeOfDay + dt) % DAY_LENGTH;
  const angle = (timeOfDay / DAY_LENGTH) * Math.PI * 2;
  const sunHeight = Math.sin(angle); // 1 — полудень, -1 — північ
  dayNightSun = sunHeight;            // для спавну/горіння зомбі

  sun.position.set(Math.cos(angle) * 100, sunHeight * 100, 30);
  sun.intensity = Math.max(0, sunHeight) * 1.2;

  const day = THREE.MathUtils.clamp((sunHeight + 0.2) / 0.6, 0.05, 1);
  hemi.intensity = 0.15 + day * 0.75;

  skyColor.lerpColors(nightColor, dayColor, day);
  // Тепле сяйво на сході/заході: лише коли сонце близько до обрію з денного боку
  const sunset = Math.max(0, 1 - Math.abs(sunHeight) / 0.22) *
                 THREE.MathUtils.clamp((sunHeight + 0.32) / 0.32, 0, 1);
  skyColor.lerp(sunsetColor, sunset * 0.55);
  scene.fog.color.copy(skyColor);

  // ===== Небесні тіла =====
  _sunDir.copy(sun.position).normalize();
  sunSprite.position.copy(_sunDir).multiplyScalar(SKY_R);
  moonSprite.position.copy(_sunDir).multiplyScalar(-SKY_R);

  // Прозорість: сонце видно над обрієм, місяць і зорі — вночі
  sunSprite.material.opacity = THREE.MathUtils.clamp((sunHeight + 0.04) / 0.12, 0, 1);
  const night = THREE.MathUtils.clamp((-sunHeight + 0.08) / 0.22, 0, 1);
  moonSprite.material.opacity = night;
  // Легке мерехтіння зір
  const twinkle = 0.85 + 0.15 * Math.sin(timeOfDay * 3.3);
  starGroup.userData.material.opacity = night * twinkle;
  // Небо повільно обертається разом із циклом доби
  starGroup.rotation.z = angle;

  // ===== Хмари =====
  // Дрейф за вітром: повільне обертання всього шару навколо вертикалі
  cloudGroup.rotation.y += dt * 0.0016;
  // Тон: білі вдень, темно-сині вночі, теплі на сході/заході
  _cloudColor.copy(cloudDayColor).lerp(cloudNightColor, 1 - day);
  _cloudColor.lerp(sunsetColor, sunset * 0.4);
  cloudMat.color.copy(_cloudColor);
  cloudMat.opacity = 0.35 + day * 0.5;

  // ===== Погода: затемнення, густіший туман і спалахи блискавки =====
  if (weatherDark > 0) {
    sun.intensity *= 1 - weatherDark;
    hemi.intensity *= 1 - weatherDark * 0.85;
    skyColor.lerp(stormGrey, weatherDark);
    cloudMat.color.lerp(stormGrey, weatherDark * 0.7);
    cloudMat.opacity = Math.min(1, cloudMat.opacity + weatherDark * 0.5);
    scene.fog.far = FOG_FAR * (1 - 0.38 * weatherIntensity);
  } else if (scene.fog.far !== FOG_FAR) {
    scene.fog.far = FOG_FAR;
  }
  if (skyFlash > 0) {
    hemi.intensity += skyFlash * 1.6;
    sun.intensity += skyFlash * 0.4;
    skyColor.lerp(flashColor, skyFlash * 0.7);
  }
  scene.fog.color.copy(skyColor);
}

// ===== HUD =====
const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const itemNameEl = document.getElementById('item-name');
const debugEl = document.getElementById('debug');
let itemNameTimer = null;

// ===== Здоров'я та повітря (HUD виживання) =====
const healthEl = document.getElementById('health');
const airEl = document.getElementById('air');
const hungerEl = document.getElementById('hunger');
const foodBadgeEl = document.getElementById('food-badge');
const foodCountEl = document.getElementById('food-count');
const vignetteEl = document.getElementById('damage-vignette');
const fireVignetteEl = document.getElementById('fire-vignette');
const deathOverlay = document.getElementById('death-overlay');
const deathCauseEl = document.getElementById('death-cause');

// Піксельні іконки серця й бульбашки малюються процедурно на canvas
const HEART_PX = [
  [0, 1, 1, 0, 1, 1, 0],
  [1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1],
  [0, 1, 1, 1, 1, 1, 0],
  [0, 0, 1, 1, 1, 0, 0],
  [0, 0, 0, 1, 0, 0, 0],
];

function drawHeart(canvas, state) {
  canvas.width = 7; canvas.height = 6;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 7, 6);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      if (!HEART_PX[r][c]) continue;
      const red = state === 'full' || (state === 'half' && c <= 2);
      ctx.fillStyle = red ? '#e0273a' : '#3a2226';
      ctx.fillRect(c, r, 1, 1);
    }
  }
}

// Піксельна «куряча ніжка»: 0 — порожньо, 1 — м'ясо, 2 — кістка
const DRUMSTICK_PX = [
  [0, 0, 1, 1, 0, 0, 0],
  [0, 1, 1, 1, 1, 0, 0],
  [0, 1, 1, 1, 1, 0, 0],
  [0, 0, 1, 1, 1, 1, 0],
  [0, 0, 0, 1, 1, 2, 2],
  [0, 0, 0, 0, 2, 2, 0],
];

function drawDrumstick(canvas, state) {
  canvas.width = 7; canvas.height = 6;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 7, 6);
  for (let r = 0; r < 6; r++) {
    for (let c = 0; c < 7; c++) {
      const px = DRUMSTICK_PX[r][c];
      if (!px) continue;
      const lit = state === 'full' || (state === 'half' && c <= 3);
      if (px === 2) ctx.fillStyle = lit ? '#f3ead2' : '#3a352a';   // кістка
      else ctx.fillStyle = lit ? '#a85327' : '#382519';            // м'ясо
      ctx.fillRect(c, r, 1, 1);
    }
  }
}

function drawBubble(canvas, full) {
  canvas.width = 8; canvas.height = 8;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 8, 8);
  ctx.beginPath();
  ctx.arc(4, 4, 3.4, 0, Math.PI * 2);
  ctx.fillStyle = full ? '#6cc8ff' : '#243340';
  ctx.fill();
  if (full) {
    ctx.beginPath();
    ctx.arc(3, 3, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#dff3ff';
    ctx.fill();
  }
}

const heartCanvases = [];
const bubbleCanvases = [];
const hungerCanvases = [];

function buildSurvivalHud() {
  healthEl.innerHTML = '';
  airEl.innerHTML = '';
  hungerEl.innerHTML = '';
  heartCanvases.length = 0;
  bubbleCanvases.length = 0;
  hungerCanvases.length = 0;
  for (let i = 0; i < 10; i++) {
    const h = document.createElement('canvas');
    h.className = 'icon';
    healthEl.appendChild(h);
    heartCanvases.push(h);
    const b = document.createElement('canvas');
    b.className = 'icon';
    airEl.appendChild(b);
    bubbleCanvases.push(b);
    const d = document.createElement('canvas');
    d.className = 'icon';
    hungerEl.appendChild(d);
    hungerCanvases.push(d);
  }
  // Іконка бейджа їжі малюється один раз (більший масштаб через CSS)
  const foodIcon = document.getElementById('food-icon');
  if (foodIcon) drawDrumstick(foodIcon, 'full');
}

let lastHealthDrawn = -1;
let lastAirDrawn = -1;
let lastHungerDrawn = -1;
let lastFoodDrawn = -1;

// Лічильник зібраного м'яса (бейдж 🍖)
function updateFoodHud() {
  if (player.food === lastFoodDrawn) return;
  lastFoodDrawn = player.food;
  foodCountEl.textContent = player.food;
  foodBadgeEl.hidden = player.food <= 0;
}

function updateSurvivalHud() {
  if (player.health !== lastHealthDrawn) {
    lastHealthDrawn = player.health;
    for (let i = 0; i < 10; i++) {
      const hp = player.health - i * 2;
      drawHeart(heartCanvases[i], hp >= 2 ? 'full' : hp >= 1 ? 'half' : 'empty');
    }
  }
  if (player.hunger !== lastHungerDrawn) {
    lastHungerDrawn = player.hunger;
    for (let i = 0; i < 10; i++) {
      const hg = player.hunger - i * 2;
      drawDrumstick(hungerCanvases[i], hg >= 2 ? 'full' : hg >= 1 ? 'half' : 'empty');
    }
  }
  const showAir = player.air < MAX_AIR - 0.05;
  airEl.style.visibility = showAir ? 'visible' : 'hidden';
  if (showAir) {
    const bubbles = Math.ceil(player.air / MAX_AIR * 10);
    if (bubbles !== lastAirDrawn) {
      lastAirDrawn = bubbles;
      for (let i = 0; i < 10; i++) drawBubble(bubbleCanvases[i], i < bubbles);
    }
  }
  vignetteEl.style.opacity = player.hurtFlash * 0.55;
  // Помаранчевий спалах горіння: пульсує, поки гравець у вогні
  fireVignetteEl.style.opacity = player.fireTicks > 0
    ? Math.min(1, player.fireTicks) * (0.7 + 0.3 * Math.sin(performance.now() / 90))
    : 0;
}

const DEATH_CAUSES = {
  fall: 'Падіння з висоти',
  drown: 'Потонув',
  tnt: 'Підірвався на динаміті',
  zombie: 'Розтерзаний зомбі',
  creeper: 'Підірваний кріпером',
  arrow: 'Застрелений скелетом',
  starve: 'Помер від голоду',
  lava: 'Згорів у лаві',
};

function showDeathScreen(cause) {
  deathCauseEl.textContent = DEATH_CAUSES[cause] || '';
  deathOverlay.hidden = false;
}

function hideDeathScreen() {
  deathOverlay.hidden = true;
}

// Малює іконку блока id у переданий canvas (вирізка з атласу текстур)
function drawBlockIcon(canvas, id) {
  canvas.width = TILE;
  canvas.height = TILE;
  if (id === TORCH) {
    // Процедурна іконка смолоскипа: держак + полум'я (без атласу)
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(7, 7, 2, 8);          // держак
    ctx.fillStyle = '#ff7a1a';
    ctx.fillRect(6, 3, 4, 4);          // полум'я (зовнішнє)
    ctx.fillStyle = '#ffd070';
    ctx.fillRect(7, 4, 2, 2);          // ядро полум'я
    return;
  }
  if (id === SEEDS) {
    // Процедурна іконка насіння: смужка грунту + паростки й зерна
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(2, 11, 12, 4);        // грунт
    ctx.fillStyle = '#6cae3e';
    ctx.fillRect(5, 5, 1, 7);          // паростки
    ctx.fillRect(8, 6, 1, 6);
    ctx.fillRect(11, 5, 1, 7);
    ctx.fillStyle = '#d9c178';
    ctx.fillRect(4, 12, 2, 2);         // зерна
    ctx.fillRect(9, 12, 2, 2);
    return;
  }
  if (id === SAPLING) {
    // Процедурна іконка саджанця: смужка грунту, стовбурець і зелена крона
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(2, 13, 12, 2);        // грунт
    ctx.fillStyle = '#7a5230';
    ctx.fillRect(7, 8, 2, 5);          // стовбурець
    ctx.fillStyle = '#3e7d2c';
    ctx.fillRect(4, 3, 8, 6);          // крона
    ctx.fillRect(6, 1, 4, 2);
    ctx.fillStyle = '#569e3d';
    ctx.fillRect(5, 4, 3, 2);          // світлі відблиски листя
    return;
  }
  if (id === BOW) {
    // Процедурна іконка лука: дерев'яна дуга, тятива й накладена стріла
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(4, 8, 9, -Math.PI / 2.6, Math.PI / 2.6);  // дуга лука
    ctx.stroke();
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(4, 1); ctx.lineTo(4, 15);              // тятива
    ctx.stroke();
    ctx.strokeStyle = '#d9c178';
    ctx.beginPath();
    ctx.moveTo(3, 8); ctx.lineTo(14, 8);              // древко стріли
    ctx.stroke();
    ctx.fillStyle = '#9099a3';
    ctx.beginPath();                                   // вістря
    ctx.moveTo(14, 6); ctx.lineTo(16, 8); ctx.lineTo(14, 10); ctx.fill();
    return;
  }
  if (id === LADDER) {
    // Процедурна іконка драбини: дві стійки та щаблі
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#9a6a33';
    ctx.fillRect(3, 1, 2, 14);          // стійки
    ctx.fillRect(11, 1, 2, 14);
    ctx.fillStyle = '#b5803f';
    ctx.fillRect(4, 3, 8, 2);           // щаблі
    ctx.fillRect(4, 7, 8, 2);
    ctx.fillRect(4, 11, 8, 2);
    return;
  }
  if (id === BED) {
    // Процедурна іконка ліжка: дерев'яний каркас, червоний матрац, біла подушка
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(1, 9, 14, 5);          // каркас
    ctx.fillStyle = '#b53a2e';
    ctx.fillRect(2, 6, 12, 4);          // матрац
    ctx.fillStyle = '#e8e4dc';
    ctx.fillRect(2, 6, 4, 4);           // подушка
    ctx.fillStyle = '#4a3219';
    ctx.fillRect(1, 13, 2, 2);          // ніжки
    ctx.fillRect(13, 13, 2, 2);
    return;
  }
  if (id === ROD) {
    // Процедурна іконка вудки: діагональне вудлище, волосінь і поплавок
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#8a5a2b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(2, 14); ctx.lineTo(12, 2);             // вудлище
    ctx.stroke();
    ctx.strokeStyle = '#e8e0d0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(12, 2); ctx.lineTo(13, 11);            // волосінь
    ctx.stroke();
    ctx.fillStyle = '#d63a2f';
    ctx.fillRect(12, 11, 3, 3);                       // поплавок (червоний низ)
    ctx.fillStyle = '#f2f2f2';
    ctx.fillRect(12, 10, 3, 1);                       // білий верх
    return;
  }
  if (id === BUCKET || id === WATER_BUCKET || id === LAVA_BUCKET) {
    // Процедурна іконка відра: сталеве цебро (трапеція) з дужкою; якщо повне —
    // усередині плескіт води (синій) чи лави (помаранчевий).
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.strokeStyle = '#9aa3ad';                       // дужка
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(8, 6, 5, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = '#b7c0c9';                         // корпус (трапеція)
    ctx.beginPath();
    ctx.moveTo(3, 6); ctx.lineTo(13, 6); ctx.lineTo(11, 15); ctx.lineTo(5, 15);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#6f7883';                       // контур і обід
    ctx.lineWidth = 1;
    ctx.stroke();
    if (id !== BUCKET) {
      ctx.fillStyle = id === WATER_BUCKET ? '#2f7bd6' : '#e8631f';   // вміст
      ctx.beginPath();
      ctx.moveTo(4, 7); ctx.lineTo(12, 7); ctx.lineTo(11, 10); ctx.lineTo(5, 10);
      ctx.closePath(); ctx.fill();
      if (id === LAVA_BUCKET) {                         // яскраві прожилки лави
        ctx.fillStyle = '#ffd24a';
        ctx.fillRect(6, 8, 2, 1); ctx.fillRect(9, 8, 1, 1);
      }
    }
    ctx.fillStyle = '#8b949e';                          // світлова смуга на металі
    ctx.fillRect(5, 11, 1, 3);
    return;
  }
  if (id === DOOR) {
    // Процедурна іконка дверей: полотно, фільонка, віконце та ручка
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#8a5a2b';
    ctx.fillRect(3, 1, 10, 14);         // полотно
    ctx.strokeStyle = '#6b4a2b';
    ctx.lineWidth = 1;
    ctx.strokeRect(3.5, 1.5, 9, 13);    // рама
    ctx.fillStyle = '#bfe3ef';
    ctx.fillRect(5, 3, 6, 4);           // віконце
    ctx.fillStyle = '#6b4a2b';
    ctx.fillRect(5, 9, 6, 4);           // фільонка
    ctx.fillStyle = '#3a2a16';
    ctx.fillRect(11, 7, 2, 2);          // ручка
    return;
  }
  if (id === FENCE) {
    // Процедурна іконка паркана: два стовпчики та дві перекладини
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#9a6a33';
    ctx.fillRect(3, 2, 2, 13);          // стовпчики
    ctx.fillRect(11, 2, 2, 13);
    ctx.fillStyle = '#b5803f';
    ctx.fillRect(1, 4, 14, 2);          // перекладини
    ctx.fillRect(1, 9, 14, 2);
    return;
  }
  if (id === GATE) {
    // Процедурна іконка хвіртки: бічні стовпи, стулка з перекладин і завіса
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#9a6a33';
    ctx.fillRect(1, 2, 2, 13);          // бічні стовпи
    ctx.fillRect(13, 2, 2, 13);
    ctx.fillStyle = '#b5803f';
    ctx.fillRect(3, 4, 10, 2);          // перекладини стулки
    ctx.fillRect(3, 9, 10, 2);
    ctx.fillRect(7, 3, 2, 9);           // середній брус
    ctx.fillStyle = '#3a2a16';
    ctx.fillRect(2, 6, 2, 2);           // завіса
    return;
  }
  if (id === BOAT) {
    // Процедурна іконка човна: дерев'яний корпус (трапеція) з бортами й хвилею
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, TILE, TILE);
    ctx.fillStyle = '#8a5a2b';                          // корпус
    ctx.beginPath();
    ctx.moveTo(2, 7); ctx.lineTo(14, 7); ctx.lineTo(12, 12); ctx.lineTo(4, 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a9793f';                          // внутрішня дошка (сидіння)
    ctx.fillRect(5, 8, 6, 2);
    ctx.strokeStyle = '#6b4a2b';                        // борти/контур
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.strokeStyle = '#2f7bd6';                        // хвиля під човном
    ctx.beginPath();
    ctx.moveTo(1, 14); ctx.quadraticCurveTo(4, 12, 8, 14);
    ctx.quadraticCurveTo(12, 16, 15, 14); ctx.stroke();
    return;
  }
  const tile = BLOCK_TILES[id].side;
  canvas.getContext('2d').drawImage(
    atlasCanvas,
    (tile % ATLAS_COLS) * TILE, Math.floor(tile / ATLAS_COLS) * TILE, TILE, TILE,
    0, 0, TILE, TILE
  );
}

// Підпис слота хотбара: 1..9, а останній — 0 (як клавіша)
const slotLabel = (i) => (i < 9 ? i + 1 : 0);

const hotbarSlotEls = [];

function buildHotbar() {
  const hotbar2 = document.getElementById('hotbar');
  hotbar2.innerHTML = '';
  hotbarSlotEls.length = 0;
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === selectedSlot ? ' selected' : '');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = slotLabel(i);
    const icon = document.createElement('canvas');
    drawBlockIcon(icon, hotbar[i]);
    slot.append(num, icon);
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selectSlot(i);
    });
    hotbar2.appendChild(slot);
    hotbarSlotEls.push({ slot, icon });
  }
}

function selectSlot(i) {
  selectedSlot = ((i % HOTBAR_SIZE) + HOTBAR_SIZE) % HOTBAR_SIZE;
  hotbarSlotEls.forEach((s, j) => s.slot.classList.toggle('selected', j === selectedSlot));
  itemNameEl.textContent = BLOCK_NAMES[hotbar[selectedSlot]];
  itemNameEl.style.opacity = 1;
  clearTimeout(itemNameTimer);
  itemNameTimer = setTimeout(() => { itemNameEl.style.opacity = 0; }, 1200);
  if (blockMenuOpen) syncBlockMenu();
}

// ===== Меню вибору блока (Tab) =====
// Призначає блок id у поточний слот хотбара
function assignBlockToSlot(id) {
  hotbar[selectedSlot] = id;
  drawBlockIcon(hotbarSlotEls[selectedSlot].icon, id);
  selectSlot(selectedSlot); // оновити назву та підсвічування (у т.ч. в меню)
}

const menuGridCells = [];
const menuHotbarEls = [];
let blockMenuEl;

function buildBlockMenu() {
  blockMenuEl = document.getElementById('block-menu');
  const grid = document.getElementById('block-grid');
  const row = document.getElementById('menu-hotbar');

  ALL_BLOCKS.forEach((id) => {
    const cell = document.createElement('button');
    cell.className = 'block-cell';
    const icon = document.createElement('canvas');
    drawBlockIcon(icon, id);
    const label = document.createElement('span');
    label.className = 'block-label';
    label.textContent = BLOCK_NAMES[id];
    cell.append(icon, label);
    cell.addEventListener('click', () => assignBlockToSlot(id));
    grid.appendChild(cell);
    menuGridCells.push({ cell, id });
  });

  for (let i = 0; i < HOTBAR_SIZE; i++) {
    const slot = document.createElement('div');
    slot.className = 'slot';
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = slotLabel(i);
    const icon = document.createElement('canvas');
    drawBlockIcon(icon, hotbar[i]);
    slot.append(num, icon);
    slot.addEventListener('click', () => selectSlot(i));
    row.appendChild(slot);
    menuHotbarEls.push({ slot, icon });
  }

  // Закриття: хрестик або клік по тлу поза панеллю
  document.getElementById('block-menu-close').addEventListener('click', closeBlockMenu);
  blockMenuEl.addEventListener('pointerdown', (e) => {
    if (e.target === blockMenuEl) closeBlockMenu();
  });
}

// Синхронізує меню з поточним станом хотбара
function syncBlockMenu() {
  menuHotbarEls.forEach((s, i) => {
    drawBlockIcon(s.icon, hotbar[i]);
    s.slot.classList.toggle('selected', i === selectedSlot);
  });
  const active = hotbar[selectedSlot];
  menuGridCells.forEach((c) => c.cell.classList.toggle('active', c.id === active));
}

function openBlockMenu() {
  if (blockMenuOpen || !gameActive()) return;
  blockMenuOpen = true;
  mining = false;
  syncBlockMenu();
  blockMenuEl.hidden = false;
  // На десктопі звільнити курсор, щоб клікати по меню (без паузи)
  if (isLocked()) document.exitPointerLock();
}

function closeBlockMenu() {
  if (!blockMenuOpen) return;
  blockMenuOpen = false;
  blockMenuEl.hidden = true;
  // На десктопі повернутись у гру, перехопивши курсор
  if (!IS_TOUCH && !mobilePlaying && renderer.domElement.requestPointerLock) {
    renderer.domElement.requestPointerLock();
  }
}

function toggleBlockMenu() {
  blockMenuOpen ? closeBlockMenu() : openBlockMenu();
}

// ===== Керування =====
const isLocked = () => document.pointerLockElement === renderer.domElement;
const gameActive = () => isLocked() || mobilePlaying;

const touchControls = document.getElementById('touch-controls');

function enterMobileMode() {
  mobilePlaying = true;
  overlay.style.display = 'none';
  hud.hidden = false;
  touchControls.hidden = false;
}

function exitMobileMode() {
  mobilePlaying = false;
  joy.active = false;
  joy.x = joy.y = 0;
  keys['Space'] = false;
  mining = false;
  cancelBowDraw();
  overlay.style.display = 'flex';
  hud.hidden = true;
  touchControls.hidden = true;
}

document.getElementById('play-btn').addEventListener('click', () => {
  Sound.resume();
  if (IS_TOUCH || !renderer.domElement.requestPointerLock) {
    enterMobileMode();
    return;
  }
  const result = renderer.domElement.requestPointerLock();
  if (result && result.catch) result.catch(() => enterMobileMode());
  // Якщо браузер мовчки відхилив pointer lock — перейти на сенсорний режим
  setTimeout(() => {
    if (!isLocked() && !mobilePlaying) enterMobileMode();
  }, 400);
});

document.addEventListener('pointerlockchange', () => {
  if (isLocked()) {
    overlay.style.display = 'none';
    hud.hidden = false;
    touchControls.hidden = true;
  } else if (!mobilePlaying && !blockMenuOpen && !achPanelOpen && !player.dead) {
    mining = false;
    cancelBowDraw();
    overlay.style.display = 'flex';
    hud.hidden = true;
  }
});

// ===== Сенсорне керування =====
// Камера: тягнути по екрану (поза джойстиком і кнопками)
let lookTouch = null;

renderer.domElement.addEventListener('touchstart', (e) => {
  if (!mobilePlaying) return;
  e.preventDefault();
  if (lookTouch === null && e.changedTouches.length > 0) {
    const t = e.changedTouches[0];
    lookTouch = { id: t.identifier, x: t.clientX, y: t.clientY };
  }
}, { passive: false });

renderer.domElement.addEventListener('touchmove', (e) => {
  if (!mobilePlaying || lookTouch === null) return;
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (t.identifier !== lookTouch.id) continue;
    player.yaw -= (t.clientX - lookTouch.x) * 0.005;
    player.pitch -= (t.clientY - lookTouch.y) * 0.005;
    player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
    lookTouch.x = t.clientX;
    lookTouch.y = t.clientY;
  }
}, { passive: false });

for (const ev of ['touchend', 'touchcancel']) {
  renderer.domElement.addEventListener(ev, (e) => {
    for (const t of e.changedTouches) {
      if (lookTouch && t.identifier === lookTouch.id) lookTouch = null;
    }
  });
}

// Джойстик руху
const joyEl = document.getElementById('joystick');
const stickEl = document.getElementById('stick');
const JOY_R = 52;

function updateJoy(t) {
  const rect = joyEl.getBoundingClientRect();
  let dx = t.clientX - (rect.left + rect.width / 2);
  let dy = t.clientY - (rect.top + rect.height / 2);
  const d = Math.hypot(dx, dy);
  if (d > JOY_R) { dx = dx / d * JOY_R; dy = dy / d * JOY_R; }
  stickEl.style.transform = `translate(${dx}px, ${dy}px)`;
  joy.x = dx / JOY_R;
  joy.y = dy / JOY_R; // вгору = вперед (від'ємний fz)
}

joyEl.addEventListener('touchstart', (e) => {
  e.preventDefault();
  const t = e.changedTouches[0];
  joy.active = true;
  joy.id = t.identifier;
  updateJoy(t);
}, { passive: false });

joyEl.addEventListener('touchmove', (e) => {
  e.preventDefault();
  for (const t of e.changedTouches) {
    if (joy.active && t.identifier === joy.id) updateJoy(t);
  }
}, { passive: false });

for (const ev of ['touchend', 'touchcancel']) {
  joyEl.addEventListener(ev, (e) => {
    for (const t of e.changedTouches) {
      if (joy.active && t.identifier === joy.id) {
        joy.active = false;
        joy.x = joy.y = 0;
        stickEl.style.transform = '';
      }
    }
  });
}

// Кнопки: стрибок, зруйнувати (з повтором при утриманні), поставити
function bindTouchButton(id, onDown, onUp) {
  const el = document.getElementById(id);
  el.addEventListener('touchstart', (e) => { e.preventDefault(); onDown(); }, { passive: false });
  for (const ev of ['touchend', 'touchcancel']) {
    el.addEventListener(ev, (e) => { e.preventDefault(); if (onUp) onUp(); }, { passive: false });
  }
}

let lastJumpTouch = -1e9;   // подвійний тап по кнопці стрибка → політ (сенсор)
bindTouchButton('btn-jump', () => {
  keys['Space'] = true;
  if (ridingBoat) { dismountBoat(); return; }   // у човні кнопка стрибка — злізти
  if (ridingHorse) { dismountHorse(); return; } // верхи — теж злізти
  const now = performance.now();
  if (now - lastJumpTouch < 320) toggleFlight();
  lastJumpTouch = now;
}, () => { keys['Space'] = false; });

bindTouchButton('btn-break',
  () => { startBreakOrAttack(); },
  () => { mining = false; releaseBow(); });

bindTouchButton('btn-place', () => placeBlock());

bindTouchButton('btn-eat', () => eatFood());

bindTouchButton('btn-inv', () => toggleBlockMenu());

document.getElementById('btn-pause').addEventListener('touchstart', (e) => {
  e.preventDefault();
  exitMobileMode();
}, { passive: false });
document.getElementById('btn-pause').addEventListener('click', () => exitMobileMode());

document.addEventListener('mousemove', (e) => {
  if (!isLocked()) return;
  player.yaw -= e.movementX * 0.0022;
  player.pitch -= e.movementY * 0.0022;
  player.pitch = THREE.MathUtils.clamp(player.pitch, -Math.PI / 2 + 0.01, Math.PI / 2 - 0.01);
});

document.addEventListener('mousedown', (e) => {
  Sound.resume();
  if (!isLocked()) return;
  if (e.button === 0) startBreakOrAttack();
  if (e.button === 2) placeBlock();
});

document.addEventListener('mouseup', (e) => {
  if (e.button === 0) { mining = false; releaseBow(); }
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

let lastSpaceDown = -1e9;   // час останнього натискання Space (для подвійного тапа → політ)
document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') {
    e.preventDefault();
    if (!e.repeat && gameActive() && !blockMenuOpen && !achPanelOpen) {
      // У човні чи верхи Space — злізти (пріоритет над подвійним тапом польоту)
      if (ridingBoat) { dismountBoat(); return; }
      if (ridingHorse) { dismountHorse(); return; }
      const now = performance.now();
      if (now - lastSpaceDown < 300) toggleFlight();
      lastSpaceDown = now;
    }
  }
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleBlockMenu();
    return;
  }
  if (e.code === 'KeyM') { Sound.resume(); applySoundState(Sound.toggle()); return; }
  if (e.code === 'KeyN') { toggleMinimap(); return; }
  if (e.code === 'KeyJ') { toggleAchPanel(); return; }
  if (e.code === 'KeyF') { Sound.resume(); eatFood(); return; }
  // Клавіші 1–9 та 0 — вибір слота хотбара (0 = десятий слот)
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n === 0) selectSlot(HOTBAR_SIZE - 1);
    else if (n >= 1 && n <= 9) selectSlot(n - 1);
  }
  if (blockMenuOpen && e.code === 'Escape') {
    e.preventDefault();
    closeBlockMenu();
  }
  if (achPanelOpen && e.code === 'Escape') {
    e.preventDefault();
    closeAchPanel();
  }
});

document.addEventListener('keyup', (e) => { keys[e.code] = false; });

document.addEventListener('wheel', (e) => {
  if (isLocked()) selectSlot(selectedSlot + Math.sign(e.deltaY));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  viewCamera.aspect = innerWidth / innerHeight;
  viewCamera.updateProjectionMatrix();
  skyCamera.aspect = innerWidth / innerHeight;
  skyCamera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

// На сенсорних пристроях показати відповідну довідку на стартовому екрані
if (IS_TOUCH) {
  document.getElementById('controls-desktop').style.display = 'none';
  document.getElementById('controls-touch').style.display = 'inline-block';
}

// ===== Збереження: автозбереження + кнопка «Нова гра» =====
if (savedGame) {
  document.getElementById('play-btn').textContent = 'Продовжити';
}

document.getElementById('new-game-btn').addEventListener('click', () => {
  // Вимкнути збереження, інакше pagehide/visibilitychange під час
  // reload запишуть світ назад одразу після очищення
  saveEnabled = false;
  clearSave();
  location.reload();
});

// Зберегти, коли вкладку згортають або закривають
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
addEventListener('pagehide', saveGame);

// ===== Головний цикл =====
// Відновити збережений хотбар (лише валідні блоки)
if (savedGame && Array.isArray(savedGame.hotbar)) {
  for (let i = 0; i < HOTBAR_SIZE; i++) {
    if (ALL_BLOCKS.includes(savedGame.hotbar[i])) hotbar[i] = savedGame.hotbar[i];
  }
}
buildHotbar();
buildBlockMenu();
buildSurvivalHud();
updateSurvivalHud();
updateFoodHud();
document.getElementById('respawn-btn').addEventListener('click', respawn);

// ===== Вимикач звуку =====
const soundBtn = document.getElementById('btn-sound');
function applySoundState(on) {
  soundBtn.textContent = on ? '🔊' : '🔇';
  soundBtn.classList.toggle('muted', !on);
}
function toggleSound() { Sound.resume(); applySoundState(Sound.toggle()); }
soundBtn.addEventListener('click', toggleSound);
soundBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleSound(); }, { passive: false });
applySoundState(Sound.isEnabled());
if (savedGame && Number.isInteger(savedGame.selectedSlot)) {
  selectSlot(savedGame.selectedSlot % HOTBAR_SIZE);
}

// ===== Мінімапа та компас =====
// Топ-даун карта місцевості навколо гравця. Поверхню семплимо процедурними
// функціями heightAt/biomeAt (без генерації чанків — швидко й без сайд-ефектів),
// поверх кладемо зміни гравця, тварин, нечисть і ліжка. Північ (−Z, напрям
// погляду при yaw=0) — догори; масштаб перемикається тапом по мінімапі.
const minimapCanvas = document.getElementById('minimap');
const mmCtx = minimapCanvas.getContext('2d');
const MM_DISPLAY = minimapCanvas.width;       // px полотна (квадрат)
const MM_RADIUS_PX = MM_DISPLAY / 2 - 3;      // радіус кружка в пікселях
const MM_CENTER = MM_DISPLAY / 2;
const MM_FIELD = 72;                          // роздільність семплінгу місцевості
const MM_ZOOMS = [32, 56, 88];                // радіус огляду в блоках (тап перемикає)
const TAU = Math.PI * 2;
let mmZoomIdx = 1;
let minimapOn = true;
let mmTimer = 0;                              // throttle важкого ресемплінгу поля

const mmField = document.createElement('canvas');
mmField.width = mmField.height = MM_FIELD;
const mmFieldCtx = mmField.getContext('2d');
const mmImage = mmFieldCtx.createImageData(MM_FIELD, MM_FIELD);
const mmHeights = new Int16Array(MM_FIELD * MM_FIELD);
let mmFieldReady = false;

// Налаштування мінімапи зберігаємо окремо від світу (щоб не чіпати версію сейва).
try {
  const s = JSON.parse(localStorage.getItem('mineclone:minimap') || '{}');
  if (typeof s.on === 'boolean') minimapOn = s.on;
  if (Number.isInteger(s.zoom) && s.zoom >= 0 && s.zoom < MM_ZOOMS.length) mmZoomIdx = s.zoom;
} catch (e) { /* перший запуск — типові налаштування */ }

function saveMinimapPrefs() {
  try {
    localStorage.setItem('mineclone:minimap', JSON.stringify({ on: minimapOn, zoom: mmZoomIdx }));
  } catch (e) { /* приватний режим — ігноруємо */ }
}

function applyMinimapVisibility() {
  minimapCanvas.classList.toggle('hidden', !minimapOn);
}
applyMinimapVisibility();

// Колір верхнього блока змін гравця, що визирає на мінімапі.
const MM_BLOCK_COLORS = {
  [GRASS]: [96, 150, 64], [DIRT]: [120, 86, 56], [STONE]: [128, 128, 132],
  [SAND]: [216, 202, 150], [LOG]: [108, 80, 48], [LEAVES]: [56, 104, 48],
  [PLANK]: [170, 132, 80], [TNT]: [184, 64, 48], [TORCH]: [240, 196, 90],
  [COAL]: [60, 60, 64], [IRON]: [176, 150, 128], [GOLD]: [222, 188, 70],
  [DIAMOND]: [110, 208, 214], [SNOW]: [232, 238, 244], [CACTUS]: [78, 132, 66],
  [BED]: [196, 60, 60], [GLASS]: [205, 230, 242], [WOOL]: [233, 230, 223],
};

// Найвищий ненульовий блок гравцевих змін у кожній колоні (id видно зверху).
function buildEditTops() {
  const tops = new Map();
  for (const [key, id] of edits) {
    if (id === AIR || isWaterId(id)) continue;
    const p = key.split(',');
    const y = +p[1];
    const col = p[0] + ',' + p[2];
    const prev = tops.get(col);
    if (!prev || y > prev.y) tops.set(col, id);
  }
  return tops;
}

// Базовий колір поверхні за вже відомою висотою h (без повторного heightAt).
function mmBaseColor(wx, wz, h, out) {
  if (h <= SEA) {                              // вода: глибше — темніше
    const d = Math.min(SEA - h, 8) / 8;
    out[0] = 60 - d * 28; out[1] = 104 - d * 46; out[2] = 176 - d * 40;
    return true;                               // true — вода (рельєфну тінь не накладаємо)
  }
  if (h <= SEA + 1) { out[0] = 214; out[1] = 198; out[2] = 146; return false; } // пляж
  const b = biomeAt(wx, wz);
  if (b === BIOME.DESERT)      { out[0] = 214; out[1] = 196; out[2] = 138; }
  else if (b === BIOME.SNOWY)  { out[0] = 230; out[1] = 236; out[2] = 244; }
  else if (b === BIOME.FOREST) { out[0] = 58;  out[1] = 110; out[2] = 52;  }
  else                         { out[0] = 104; out[1] = 158; out[2] = 70;  } // рівнина
  return false;
}

// Перемалювати растрове поле місцевості (важка частина — throttle у animate).
const mmRGB = [0, 0, 0];
function updateMinimapField() {
  const R = MM_ZOOMS[mmZoomIdx];
  const N = MM_FIELD;
  const step = (R * 2) / N;
  const x0 = player.pos.x - R, z0 = player.pos.z - R;
  const editTops = buildEditTops();

  // Прохід 1: висоти (по одному heightAt на клітинку — для рельєфної тіні).
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const wx = Math.floor(x0 + i * step), wz = Math.floor(z0 + j * step);
      mmHeights[j * N + i] = heightAt(wx, wz);
    }
  }

  // Прохід 2: колір. Світло з північного заходу дає легкий об'єм рельєфу.
  const data = mmImage.data;
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const wx = Math.floor(x0 + i * step), wz = Math.floor(z0 + j * step);
      const h = mmHeights[j * N + i];
      const edit = editTops.get(wx + ',' + wz);
      let r, g, b;
      if (edit !== undefined) {
        const c = MM_BLOCK_COLORS[edit] || [150, 150, 150];
        r = c[0]; g = c[1]; b = c[2];
      } else {
        const water = mmBaseColor(wx, wz, h, mmRGB);
        r = mmRGB[0]; g = mmRGB[1]; b = mmRGB[2];
        if (!water) {
          const hl = i > 0 ? mmHeights[j * N + i - 1] : h;
          const hu = j > 0 ? mmHeights[(j - 1) * N + i] : h;
          const f = THREE.MathUtils.clamp(1 + ((h - hl) + (h - hu)) * 0.09, 0.68, 1.3);
          r *= f; g *= f; b *= f;
        }
      }
      const o = (j * N + i) * 4;
      data[o] = Math.max(0, Math.min(255, r));
      data[o + 1] = Math.max(0, Math.min(255, g));
      data[o + 2] = Math.max(0, Math.min(255, b));
      data[o + 3] = 255;
    }
  }
  mmFieldCtx.putImageData(mmImage, 0, 0);
  mmFieldReady = true;
}

// Намалювати маркер сутності, якщо вона в межах огляду.
function mmDot(ctx, dx, dz, R, color, size) {
  if (Math.abs(dx) > R || Math.abs(dz) > R) return;
  const sx = MM_CENTER + (dx / R) * MM_RADIUS_PX;
  const sy = MM_CENTER + (dz / R) * MM_RADIUS_PX;
  ctx.beginPath();
  ctx.arc(sx, sy, size, 0, TAU);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
}

const MM_ANIMAL_COLORS = { pig: '#eba6a0', cow: '#9c7b56', chicken: '#f2f0ea', sheep: '#e9e6df', wolf: '#a7adb8' };

// Композиція кадру мінімапи: кешоване поле + живі маркери щокадру (дешево).
function drawMinimap() {
  const R = MM_ZOOMS[mmZoomIdx];
  const px = player.pos.x, pz = player.pos.z;
  mmCtx.clearRect(0, 0, MM_DISPLAY, MM_DISPLAY);

  mmCtx.save();
  mmCtx.beginPath();
  mmCtx.arc(MM_CENTER, MM_CENTER, MM_RADIUS_PX, 0, TAU);
  mmCtx.clip();

  if (mmFieldReady) {
    mmCtx.imageSmoothingEnabled = false;
    mmCtx.drawImage(mmField, 0, 0, MM_FIELD, MM_FIELD, 0, 0, MM_DISPLAY, MM_DISPLAY);
  } else {
    mmCtx.fillStyle = '#1a1f15';
    mmCtx.fillRect(0, 0, MM_DISPLAY, MM_DISPLAY);
  }

  // Ліжка (закріплена точка відродження орієнтує мандрівника).
  for (const bed of beds.values()) {
    mmDot(mmCtx, bed.x + 0.5 - px, bed.z + 0.5 - pz, R, '#d65b6e', 3);
  }
  // Тварини (приручений вовк — золотавий, щоб не загубити друга).
  for (const a of animals) {
    const color = a.tamed ? '#f2c14e' : MM_ANIMAL_COLORS[a.type] || '#cfcfcf';
    mmDot(mmCtx, a.pos.x - px, a.pos.z - pz, R, color, 2.5);
  }
  // Нечисть.
  for (const m of mobs) {
    mmDot(mmCtx, m.pos.x - px, m.pos.z - pz, R, '#e8412e', 3);
  }

  // Гравець у центрі: трикутник за напрямком погляду (вперед = (−sin,−cos)).
  const fx = -Math.sin(player.yaw), fz = -Math.cos(player.yaw);
  const rx = -fz, rz = fx;        // вектор «праворуч»
  mmCtx.beginPath();
  mmCtx.moveTo(MM_CENTER + fx * 7, MM_CENTER + fz * 7);
  mmCtx.lineTo(MM_CENTER - fx * 4 + rx * 4, MM_CENTER - fz * 4 + rz * 4);
  mmCtx.lineTo(MM_CENTER - fx * 4 - rx * 4, MM_CENTER - fz * 4 - rz * 4);
  mmCtx.closePath();
  mmCtx.fillStyle = '#ffffff';
  mmCtx.fill();
  mmCtx.lineWidth = 1.5;
  mmCtx.strokeStyle = '#1a1a1a';
  mmCtx.stroke();
  mmCtx.restore();

  // Кільце-рамка.
  mmCtx.beginPath();
  mmCtx.arc(MM_CENTER, MM_CENTER, MM_RADIUS_PX, 0, TAU);
  mmCtx.lineWidth = 2;
  mmCtx.strokeStyle = 'rgba(255,255,255,0.45)';
  mmCtx.stroke();

  // Компас (північ догори — мітки статичні) + поточний масштаб.
  mmCtx.fillStyle = 'rgba(255,255,255,0.9)';
  mmCtx.font = 'bold 11px system-ui, sans-serif';
  mmCtx.textAlign = 'center';
  mmCtx.textBaseline = 'middle';
  mmCtx.shadowColor = 'rgba(0,0,0,0.85)';
  mmCtx.shadowBlur = 2;
  const ringR = MM_RADIUS_PX - 8;
  mmCtx.fillStyle = '#ff8a7a';
  mmCtx.fillText('Пн', MM_CENTER, MM_CENTER - ringR);
  mmCtx.fillStyle = 'rgba(255,255,255,0.9)';
  mmCtx.fillText('Сх', MM_CENTER + ringR, MM_CENTER);
  mmCtx.fillText('Пд', MM_CENTER, MM_CENTER + ringR);
  mmCtx.fillText('Зх', MM_CENTER - ringR, MM_CENTER);
  mmCtx.shadowBlur = 0;
  mmCtx.font = '9px system-ui, sans-serif';
  mmCtx.fillStyle = 'rgba(255,255,255,0.75)';
  mmCtx.fillText('±' + R, MM_CENTER, MM_DISPLAY - 7);
  mmCtx.textAlign = 'start';
  mmCtx.textBaseline = 'alphabetic';
}

function cycleMinimapZoom() {
  mmZoomIdx = (mmZoomIdx + 1) % MM_ZOOMS.length;
  mmTimer = 0;            // негайно перемалювати поле під новий масштаб
  saveMinimapPrefs();
}

function toggleMinimap() {
  minimapOn = !minimapOn;
  applyMinimapVisibility();
  if (minimapOn) mmTimer = 0;
  saveMinimapPrefs();
}

minimapCanvas.addEventListener('click', cycleMinimapZoom);
minimapCanvas.addEventListener('touchstart', (e) => {
  e.preventDefault();
  cycleMinimapZoom();
}, { passive: false });

// ============================================================
// Досягнення (Advancements): прогрес-система поверх усіх механік
// ============================================================
// Здобуті досягнення зберігаються окремо від світу (свій ключ localStorage),
// тож «Нова гра» чи зміна версії сейва їх не чіпають — це наскрізні здобутки.
// unlockAch(id) — ідемпотентний: повторний виклик нічого не робить. Виклики
// розкидані по ігрових функціях (видобуток, бій, ферма, сон, мандри…).
const ACHIEVEMENTS = [
  { id: 'first_block', icon: '⛏', title: 'Перший удар',        desc: 'Зруйнувати свій перший блок' },
  { id: 'place_block', icon: '🧱', title: 'Будівничий',         desc: 'Поставити блок' },
  { id: 'chop_wood',   icon: '🪵', title: 'Лісоруб',            desc: 'Добути деревину' },
  { id: 'coal',        icon: '⚫', title: 'Паливо',             desc: 'Видобути вугілля' },
  { id: 'iron',        icon: '⛓',  title: 'Залізна доба',       desc: 'Видобути залізо' },
  { id: 'gold',        icon: '🟡', title: 'Золота лихоманка',   desc: 'Видобути золото' },
  { id: 'diamond',     icon: '💎', title: 'Найкращі друзі',     desc: 'Видобути алмаз' },
  { id: 'geologist',   icon: '🪨', title: 'Геолог',             desc: 'Видобути всі чотири руди' },
  { id: 'deep',        icon: '🕳', title: 'Надра землі',        desc: 'Спуститися глибше за y=6' },
  { id: 'peak',        icon: '🏔', title: 'Підкорювач вершин',  desc: 'Піднятися вище за y=52' },
  { id: 'swim',        icon: '🏊', title: 'Плавець',            desc: 'Поплавати у воді' },
  { id: 'boom',        icon: '🧨', title: 'Бабах!',             desc: 'Підірвати динаміт' },
  { id: 'torch',       icon: '🔦', title: 'Світло у пітьмі',    desc: 'Поставити смолоскип' },
  { id: 'plant',       icon: '🌱', title: 'Фермер',             desc: 'Посіяти насіння' },
  { id: 'harvest',     icon: '🌾', title: 'Урожай',             desc: 'Зібрати дозрілий колос' },
  { id: 'eat',         icon: '🍖', title: 'Перекус',            desc: "З'їсти їжу" },
  { id: 'hunt',        icon: '🐷', title: 'Мисливець',          desc: 'Уполювати тварину' },
  { id: 'archer',      icon: '🏹', title: 'Лучник',             desc: 'Випустити стрілу з лука' },
  { id: 'fisher',      icon: '🎣', title: 'Рибалка',            desc: 'Упіймати рибу вудкою' },
  { id: 'ouch',        icon: '💢', title: 'Боляче',             desc: 'Дістати поранення' },
  { id: 'death',       icon: '💀', title: 'І знову початок',    desc: 'Загинути' },
  { id: 'zombie',      icon: '🧟', title: 'Нічний вартовий',    desc: 'Здолати зомбі' },
  { id: 'creeper',     icon: '💥', title: 'Знешкоджено',        desc: 'Здолати кріпера' },
  { id: 'skeleton',    icon: '☠',  title: 'Дуель лучників',     desc: 'Здолати скелета' },
  { id: 'sleep',       icon: '🛏', title: 'На добраніч',        desc: 'Проспати ніч у ліжку' },
  { id: 'biome_plains',icon: '🌳', title: 'Рівнини',            desc: 'Побувати на рівнині' },
  { id: 'biome_forest',icon: '🌲', title: 'Хащі',               desc: 'Побувати в лісі' },
  { id: 'biome_desert',icon: '🌵', title: 'Спека',              desc: 'Побувати в пустелі' },
  { id: 'biome_snowy', icon: '❄', title: 'Мерзлота',           desc: 'Побувати в сніговій тундрі' },
  { id: 'cartographer',icon: '🗺', title: 'Картограф',          desc: 'Відвідати всі чотири біоми' },
  { id: 'lava',        icon: '🌋', title: 'Пекуче знайомство',  desc: 'Обпектися лавою' },
  { id: 'fly',         icon: '🕊', title: 'Політ',              desc: 'Здійнятися в політ (подвійний Space)' },
  { id: 'bucket',      icon: '🪣', title: 'Водовоз',            desc: 'Набрати воду чи лаву у відро' },
  { id: 'sailor',      icon: '🚣', title: 'Мореплавець',        desc: 'Відплисти на човні' },
  { id: 'climb',       icon: '🪜', title: 'Верхолаз',           desc: 'Піднятися драбиною' },
  { id: 'glazier',     icon: '🪟', title: 'Вікно у світ',       desc: 'Поставити скляний блок' },
  { id: 'homeowner',   icon: '🚪', title: 'Домовласник',        desc: 'Поставити двері' },
  { id: 'shear',       icon: '🐑', title: 'Стрижій',            desc: 'Обстригти вівцю' },
  { id: 'tame',        icon: '🐺', title: 'Вірний друг',        desc: 'Приручити вовка' },
  { id: 'fence',       icon: '🚧', title: 'Обгороджено',        desc: 'Поставити паркан чи хвіртку' },
  { id: 'grow_tree',   icon: '🌳', title: 'Лісівник',           desc: 'Виростити дерево з саджанця' },
  { id: 'rider',       icon: '🐴', title: 'Вершник',            desc: 'Приручити коня й сісти верхи' },
  { id: 'master',      icon: '🏆', title: 'Майстер MineClone',  desc: 'Здобути всі інші досягнення' },
];
const ACH_BY_ID = Object.fromEntries(ACHIEVEMENTS.map((a) => [a.id, a]));
const ACH_KEY = 'mineclone:achievements';
const achUnlocked = new Set();

try {
  const raw = JSON.parse(localStorage.getItem(ACH_KEY) || '[]');
  if (Array.isArray(raw)) raw.forEach((id) => { if (ACH_BY_ID[id]) achUnlocked.add(id); });
} catch (e) { /* перший запуск — порожній набір */ }

function saveAchievements() {
  try { localStorage.setItem(ACH_KEY, JSON.stringify([...achUnlocked])); } catch (e) { /* ignore */ }
}

const achToastsEl = document.getElementById('ach-toasts');
const achPanelEl = document.getElementById('ach-panel');
const achGridEl = document.getElementById('ach-grid');
const achCountEl = document.getElementById('ach-count');
let achPanelOpen = false;

function showAchToast(a) {
  if (!achToastsEl) return;
  const el = document.createElement('div');
  el.className = 'ach-toast';
  const icon = document.createElement('span');
  icon.className = 'ach-toast-icon';
  icon.textContent = a.icon;
  const text = document.createElement('span');
  text.className = 'ach-toast-text';
  const head = document.createElement('b');
  head.textContent = 'Досягнення здобуто!';
  const title = document.createElement('span');
  title.textContent = a.title;
  text.append(head, title);
  el.append(icon, text);
  achToastsEl.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 450);
  }, 4200);
}

// Головна точка входу: позначити досягнення здобутим (ідемпотентно).
function unlockAch(id) {
  const a = ACH_BY_ID[id];
  if (!a || achUnlocked.has(id)) return;
  achUnlocked.add(id);
  saveAchievements();
  showAchToast(a);
  Sound.achievement();
  if (achPanelOpen) renderAchPanel();
  // Похідні (мета) досягнення — перевіряємо після кожного нового здобутку
  if (['coal', 'iron', 'gold', 'diamond'].every((k) => achUnlocked.has(k))) unlockAch('geologist');
  if (['biome_plains', 'biome_forest', 'biome_desert', 'biome_snowy'].every((k) => achUnlocked.has(k))) unlockAch('cartographer');
  if (ACHIEVEMENTS.every((x) => x.id === 'master' || achUnlocked.has(x.id))) unlockAch('master');
}

function renderAchPanel() {
  if (!achGridEl) return;
  achCountEl.textContent = `${achUnlocked.size} / ${ACHIEVEMENTS.length}`;
  achGridEl.innerHTML = '';
  for (const a of ACHIEVEMENTS) {
    const got = achUnlocked.has(a.id);
    const cell = document.createElement('div');
    cell.className = 'ach-cell ' + (got ? 'unlocked' : 'locked');
    const ic = document.createElement('div');
    ic.className = 'ach-icon';
    ic.textContent = got ? a.icon : '🔒';
    const info = document.createElement('div');
    info.className = 'ach-info';
    const t = document.createElement('div');
    t.className = 'ach-title';
    t.textContent = got ? a.title : '???';
    const d = document.createElement('div');
    d.className = 'ach-desc';
    d.textContent = a.desc;
    info.append(t, d);
    cell.append(ic, info);
    achGridEl.appendChild(cell);
  }
}

function openAchPanel() {
  if (achPanelOpen || !gameActive()) return;
  if (blockMenuOpen) closeBlockMenu();
  achPanelOpen = true;
  mining = false;
  cancelBowDraw();
  renderAchPanel();
  achPanelEl.hidden = false;
  if (isLocked()) document.exitPointerLock();   // звільнити курсор для перегляду
}

function closeAchPanel() {
  if (!achPanelOpen) return;
  achPanelOpen = false;
  achPanelEl.hidden = true;
  if (!IS_TOUCH && !mobilePlaying && renderer.domElement.requestPointerLock) {
    renderer.domElement.requestPointerLock();
  }
}

function toggleAchPanel() { achPanelOpen ? closeAchPanel() : openAchPanel(); }

document.getElementById('ach-close').addEventListener('click', closeAchPanel);
achPanelEl.addEventListener('click', (e) => { if (e.target === achPanelEl) closeAchPanel(); });

const achBtn = document.getElementById('btn-ach');
achBtn.addEventListener('click', toggleAchPanel);
achBtn.addEventListener('touchstart', (e) => { e.preventDefault(); toggleAchPanel(); }, { passive: false });

// Невеликий діагностичний інтерфейс (ручне тестування зомбі та циклу доби з консолі)
window.MCDebug = {
  setTime: (t) => { timeOfDay = ((t % DAY_LENGTH) + DAY_LENGTH) % DAY_LENGTH; },
  night: () => { timeOfDay = DAY_LENGTH * 0.75; },       // північ
  day: () => { timeOfDay = DAY_LENGTH * 0.25; },         // ранок
  spawnZombie: (n = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * 4;
      const x = Math.floor(player.pos.x + Math.cos(a) * d);
      const z = Math.floor(player.pos.z + Math.sin(a) * d);
      const h = heightAt(x, z);
      spawnMob(x + 0.5, h + 1.01, z + 0.5);
    }
    return mobs.length;
  },
  spawnCreeper: (n = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 4 + Math.random() * 4;
      const x = Math.floor(player.pos.x + Math.cos(a) * d);
      const z = Math.floor(player.pos.z + Math.sin(a) * d);
      const h = heightAt(x, z);
      spawnMob(x + 0.5, h + 1.01, z + 0.5, 'creeper');
    }
    return mobs.filter((m) => m.type === 'creeper').length;
  },
  spawnSkeleton: (n = 1) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const d = 7 + Math.random() * 4;
      const x = Math.floor(player.pos.x + Math.cos(a) * d);
      const z = Math.floor(player.pos.z + Math.sin(a) * d);
      const h = heightAt(x, z);
      spawnMob(x + 0.5, h + 1.01, z + 0.5, 'skeleton');
    }
    return mobs.filter((m) => m.type === 'skeleton').length;
  },
  setWeather: (s) => {
    if (s !== 'rain' && s !== 'snow' && s !== 'clear') return 'use "rain" | "snow" | "clear"';
    weatherState = s;
    weatherTimer = 90;
    if (s !== 'clear') lightningTimer = 3 + Math.random() * 8;
    return s;
  },
  get weather() { return { state: weatherState, intensity: +weatherIntensity.toFixed(2) }; },
  get mobs() { return mobs; },
  get player() { return player; },
  get torches() { return torches.size; },
  get crops() { return crops.size; },
  get arrows() { return arrows.length; },
  // Випустити стрілу із заданою силою натягу (0..1) — для тестів лука
  shootArrow: (power = 1) => {
    spawnArrow(THREE.MathUtils.clamp(power, 0, 1));
    Sound.bowShoot(power);
    return arrows.length;
  },
  // Дати лук у поточний слот хотбара (зручно для тестів)
  giveBow: () => { assignBlockToSlot(BOW); return BLOCK_NAMES[BOW]; },
  giveRod: () => { assignBlockToSlot(ROD); return BLOCK_NAMES[ROD]; },
  giveLadder: () => { assignBlockToSlot(LADDER); return BLOCK_NAMES[LADDER]; },
  giveDoor: () => { assignBlockToSlot(DOOR); return BLOCK_NAMES[DOOR]; },
  // Поставити двері на поверхню за 2 блоки на схід від гравця (для тестів)
  doorNear: (dx = -1, dz = 0) => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return null;
    if (blockAt(x, gy + 1, z) !== AIR || blockAt(x, gy + 2, z) !== AIR) return null;
    return addDoor(x, gy + 1, z, dx, dz) ? { x, y: gy + 1, z } : null;
  },
  // Перемкнути найближчі до гравця двері (для тестів)
  toggleNearDoor: () => {
    let best = null, bestDist = Infinity;
    for (const d of doors.values()) {
      const dist = Math.hypot(d.x + 0.5 - player.pos.x, d.z + 0.5 - player.pos.z);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    if (!best) return null;
    const toggled = toggleDoor(best);
    return { toggled, open: best.open, x: best.x, y: best.y, z: best.z };
  },
  // Стан найближчих до гравця дверей (для тестів)
  doorState: () => {
    let best = null, bestDist = Infinity;
    for (const d of doors.values()) {
      const dist = Math.hypot(d.x + 0.5 - player.pos.x, d.z + 0.5 - player.pos.z);
      if (dist < bestDist) { bestDist = dist; best = d; }
    }
    return best ? { open: best.open, x: best.x, y: best.y, z: best.z, dx: best.dx, dz: best.dz } : null;
  },
  get doors() { return doors.size; },
  doorBlocked: (x, y, z) => doorBlocksCell(x, y, z),
  // Паркани та хвіртки (для тестів)
  giveFence: () => { assignBlockToSlot(FENCE); return BLOCK_NAMES[FENCE]; },
  giveGate: () => { assignBlockToSlot(GATE); return BLOCK_NAMES[GATE]; },
  giveSapling: () => { assignBlockToSlot(SAPLING); return BLOCK_NAMES[SAPLING]; },
  // Посадити саджанець на поверхню за (dx,dz) блоків від гравця
  saplingNear: (dx = 2, dz = 0) => {
    const x = Math.floor(player.pos.x) + dx, z = Math.floor(player.pos.z) + dz;
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0 || !cropSupportable(blockAt(x, gy, z)) || blockAt(x, gy + 1, z) !== AIR) return null;
    return addSapling(x, gy + 1, z) ? { x, y: gy + 1, z } : null;
  },
  // Миттєво доростити всі саджанці (виростити дерева)
  growSaplings: () => {
    let grown = 0;
    for (const s of [...saplings.values()]) if (growSaplingTree(s)) grown++;
    return { grown, waiting: saplings.size };
  },
  saplingState: () => [...saplings.values()].map((s) =>
    ({ x: s.x, y: s.y, z: s.z, growth: +s.growth.toFixed(1) })),
  get saplingCount() { return saplings.size; },
  get fences() { return fences.size; },
  get gates() { return gates.size; },
  fenceBlocked: (x, y, z) => fenceBlocksCell(x, y, z),
  // Поставити паркан на поверхню за (dx,dz) блоків від гравця
  fenceNear: (dx = 2, dz = 0) => {
    const x = Math.floor(player.pos.x) + dx, z = Math.floor(player.pos.z) + dz;
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0 || blockAt(x, gy + 1, z) !== AIR) return null;
    return addFence(x, gy + 1, z) ? { x, y: gy + 1, z } : null;
  },
  // Поставити хвіртку на поверхню за (dx,dz) блоків від гравця
  gateNear: (dx = 2, dz = 0, fdx = -1, fdz = 0) => {
    const x = Math.floor(player.pos.x) + dx, z = Math.floor(player.pos.z) + dz;
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0 || blockAt(x, gy + 1, z) !== AIR) return null;
    return addGate(x, gy + 1, z, fdx, fdz) ? { x, y: gy + 1, z } : null;
  },
  // Перемкнути найближчу до гравця хвіртку (для тестів)
  toggleNearGate: () => {
    let best = null, bestDist = Infinity;
    for (const g of gates.values()) {
      const dist = Math.hypot(g.x + 0.5 - player.pos.x, g.z + 0.5 - player.pos.z);
      if (dist < bestDist) { bestDist = dist; best = g; }
    }
    if (!best) return null;
    const toggled = toggleGate(best);
    return { toggled, open: best.open, x: best.x, y: best.y, z: best.z };
  },
  // Стан найближчої до гравця хвіртки (для тестів)
  gateState: () => {
    let best = null, bestDist = Infinity;
    for (const g of gates.values()) {
      const dist = Math.hypot(g.x + 0.5 - player.pos.x, g.z + 0.5 - player.pos.z);
      if (dist < bestDist) { bestDist = dist; best = g; }
    }
    return best ? { open: best.open, x: best.x, y: best.y, z: best.z, dx: best.dx, dz: best.dz } : null;
  },
  setBlock: (x, y, z, id) => setBlock(x, y, z, id),
  giveGlass: () => { assignBlockToSlot(GLASS); return BLOCK_NAMES[GLASS]; },
  giveWool: () => { assignBlockToSlot(WOOL); return BLOCK_NAMES[WOOL]; },
  // Вівця просто перед гравцем (для тестів стрижки)
  spawnSheep: () => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return null;
    spawnAnimal('sheep', x + 0.5, gy + 1.01, z + 0.5);
    return { x: x + 0.5, y: gy + 1.01, z: z + 0.5 };
  },
  // Стан найближчої вівці: вовна на місці чи острижена
  sheepState: () => {
    let best = null, bestDist = Infinity;
    for (const a of animals) {
      if (a.type !== 'sheep') continue;
      const dist = a.pos.distanceTo(player.pos);
      if (dist < bestDist) { bestDist = dist; best = a; }
    }
    return best ? { wool: best.wool, woolTimer: best.woolTimer, health: best.health } : null;
  },
  get sheepCount() { return animals.filter((a) => a.type === 'sheep').length; },
  // ===== Вовки: інспекція та тестування з консолі =====
  get wolves() {
    return animals.filter((a) => a.type === 'wolf').map((a) => ({
      tamed: a.tamed, sitting: a.sitting, fed: a.fedCount,
      health: +a.health.toFixed(1),
      dist: +a.pos.distanceTo(player.pos).toFixed(1),
    }));
  },
  // Вовк просто перед гравцем (для тестів приручення)
  spawnWolf: () => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return null;
    spawnAnimal('wolf', x + 0.5, gy + 1.01, z + 0.5);
    return { x: x + 0.5, y: gy + 1.01, z: z + 0.5 };
  },
  // Поповнити торбу їжі (для тестів годування)
  giveMeat: (n = 10) => {
    player.food = Math.min(FOOD_MAX, player.food + n);
    updateFoodHud();
    return player.food;
  },
  // Погодувати найближчого вовка тим самим шляхом, що й ПКМ (для тестів)
  feedWolf: () => {
    const w = nearestWolf();
    if (!w) return null;
    const fed = feedWolfEntity(w);
    return { fed, tamed: w.tamed, fedCount: w.fedCount, health: +w.health.toFixed(1), food: player.food };
  },
  // Стан найближчого вовка (для тестів слідування/охорони)
  wolfState: () => {
    const w = nearestWolf();
    if (!w) return null;
    return {
      tamed: w.tamed, sitting: w.sitting, fedCount: w.fedCount,
      health: +w.health.toFixed(1), state: w.state,
      dist: +w.pos.distanceTo(player.pos).toFixed(2),
      x: +w.pos.x.toFixed(1), y: +w.pos.y.toFixed(1), z: +w.pos.z.toFixed(1),
    };
  },
  // Команда «сидіти/йти» найближчому прирученому вовку (для тестів)
  toggleSitWolf: () => {
    const w = nearestWolf();
    if (!w || !w.tamed) return null;
    w.sitting = !w.sitting;
    return { sitting: w.sitting };
  },
  // Телепортувати гравця (для тестів телепорту вовка при відставанні)
  tpPlayer: (dx = 30, dz = 0) => {
    const x = Math.floor(player.pos.x + dx), z = Math.floor(player.pos.z + dz);
    player.pos.set(x + 0.5, safeSpawnY(x, z), z + 0.5);
    player.vel.set(0, 0, 0);
    return { x: player.pos.x, y: player.pos.y, z: player.pos.z };
  },
  // Удар по найближчій вівці (як ЛКМ упритул) — для тестів стрижки
  hitNearSheep: () => {
    let best = null, bestDist = Infinity;
    for (const a of animals) {
      if (a.type !== 'sheep') continue;
      const dist = a.pos.distanceTo(player.pos);
      if (dist < bestDist) { bestDist = dist; best = a; }
    }
    if (!best) return null;
    damageEntity(best, true, 5, best.pos.x - player.pos.x, best.pos.z - player.pos.z, 4);
    return { wool: best.wool, health: best.health };
  },
  // Скляна стінка 3×3 поряд із гравцем (для тестів рендера прозорості)
  glassWallNear: () => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return 0;
    let placed = 0;
    for (let dz = -1; dz <= 1; dz++) {
      for (let dy = 1; dy <= 3; dy++) {
        if (blockAt(x, gy + dy, z + dz) === AIR) { setBlock(x, gy + dy, z + dz, GLASS); placed++; }
      }
    }
    return placed;
  },
  blockAt: (x, y, z) => blockAt(x, y, z),
  get ladders() { return ladders.size; },
  get climbed() { return player.climbed; },
  get onLadder() { return playerOnLadder(); },
  // Побудувати кам'яний стовп із драбиною за 2 блоки на схід від гравця
  // (для тестів лазіння): стовп у (x+2, z), драбини на його західній грані
  ladderColumnNear: (h = 4) => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return 0;
    let placed = 0;
    for (let i = 1; i <= h; i++) {
      setBlock(x, gy + i, z, STONE);
      if (blockAt(x - 1, gy + i, z) === AIR && addLadder(x - 1, gy + i, z, 1, 0)) placed++;
    }
    return placed;
  },
  // Відро: видати порожнє/повне у слот і застосувати (набрати чи вилити) — для тестів
  giveBucket: (kind = 'empty') => {
    const id = kind === 'water' ? WATER_BUCKET : kind === 'lava' ? LAVA_BUCKET : BUCKET;
    assignBlockToSlot(id);
    return BLOCK_NAMES[id];
  },
  useBucket: () => { useBucket(); return BLOCK_NAMES[hotbar[selectedSlot]]; },
  get held() { return BLOCK_NAMES[hotbar[selectedSlot]]; },
  get heldId() { return hotbar[selectedSlot]; },
  // Повернути погляд гравця (для детермінованих тестів; кути в радіанах)
  look: (yaw = 0, pitch = 0) => { player.yaw = yaw; player.pitch = pitch; },
  // Промінь погляду (позиція камери + напрямок) — для детермінованих тестів
  viewRay: () => {
    const d = new THREE.Vector3();
    camera.getWorldDirection(d);
    const o = camera.position;
    return { ox: o.x, oy: o.y, oz: o.z, dx: d.x, dy: d.y, dz: d.z };
  },
  // Миттєво довести всі посіви до зрілості (для тестів)
  growCrops: () => {
    for (const c of crops.values()) { c.stage = CROP_STAGES - 1; c.growth = 0; applyCropStage(c); }
    return crops.size;
  },
  // Засіяти грядку поряд із гравцем (для тестів)
  plantNear: (n = 4) => {
    let planted = 0;
    for (let i = 0; i < n; i++) {
      const x = Math.floor(player.pos.x) + (i % 2) * 2 - 1;
      const z = Math.floor(player.pos.z) + Math.floor(i / 2) * 2 - 1;
      for (let y = Math.ceil(player.pos.y) + 2; y > Math.floor(player.pos.y) - 4; y--) {
        if (cropSupportable(blockAt(x, y - 1, z)) && blockAt(x, y, z) === AIR) {
          if (addCrop(x, y, z)) planted++;
          break;
        }
      }
    }
    return planted;
  },
  // Поставити ліжко поряд із гравцем на тверду опору (для тестів)
  placeBed: () => {
    const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z) + 1;
    for (let y = Math.ceil(player.pos.y) + 1; y > Math.floor(player.pos.y) - 4; y--) {
      if (isSolid(blockAt(x, y - 1, z)) && blockAt(x, y, z) === AIR) {
        addBed(x, y, z, 0);
        break;
      }
    }
    return beds.size;
  },
  // Лягти спати в найближче ліжко (повертає true, якщо сон почався)
  sleep: () => trySleep([...beds.values()][0]),
  // Прибрати всю нічну нечисть (зручно перед тестом сну)
  clearMobs: () => { for (let i = mobs.length - 1; i >= 0; i--) removeMob(i); return mobs.length; },
  get beds() { return beds.size; },
  get sleeping() { return sleeping; },
  // Досягнення: ручне тестування з консолі
  get achievements() {
    return ACHIEVEMENTS.map((a) => ({ id: a.id, title: a.title, got: achUnlocked.has(a.id) }));
  },
  get achProgress() { return `${achUnlocked.size} / ${ACHIEVEMENTS.length}`; },
  unlock: (id) => { unlockAch(id); return achUnlocked.has(id); },
  unlockAll: () => { for (const a of ACHIEVEMENTS) unlockAch(a.id); return achUnlocked.size; },
  resetAchievements: () => {
    achUnlocked.clear(); saveAchievements();
    if (achPanelOpen) renderAchPanel();
    return achUnlocked.size;
  },
  toggleAchPanel: () => { toggleAchPanel(); return achPanelOpen; },
  // Політ: перемикання й стан із консолі для тестів
  toggleFly: () => { toggleFlight(); return player.flying; },
  get flying() { return player.flying; },
  get spawnPoint() { return spawnPoint ? { ...spawnPoint } : null; },
  get time() { return timeOfDay; },
  get active() { return gameActive(); },
  // Мінімапа: керування з консолі для ручного тестування.
  toggleMinimap: () => { toggleMinimap(); return minimapOn; },
  minimapZoom: (i) => {
    if (Number.isInteger(i)) {
      mmZoomIdx = ((i % MM_ZOOMS.length) + MM_ZOOMS.length) % MM_ZOOMS.length;
      mmTimer = 0; saveMinimapPrefs();
    }
    return { index: mmZoomIdx, radius: MM_ZOOMS[mmZoomIdx], on: minimapOn };
  },
  // Біом під гравцем (для тестів)
  get biome() {
    return BIOME_NAMES[biomeAt(Math.floor(player.pos.x), Math.floor(player.pos.z))];
  },
  // Телепортувати гравця до найближчого сухого регіону вказаного біому.
  // Приймає укр./англ. назву: 'desert'|'пустеля', 'snowy'|'тундра',
  // 'forest'|'ліс', 'plains'|'рівнина'. Повертає координати або null.
  tpBiome: (name) => {
    const aliases = {
      plains: BIOME.PLAINS, рівнина: BIOME.PLAINS,
      forest: BIOME.FOREST, ліс: BIOME.FOREST,
      desert: BIOME.DESERT, пустеля: BIOME.DESERT,
      snowy: BIOME.SNOWY, tundra: BIOME.SNOWY, тундра: BIOME.SNOWY,
    };
    const target = aliases[String(name).toLowerCase()];
    if (target === undefined) return 'use: plains | forest | desert | snowy';
    // Точка вважається «всередині» біому, якщо вона й проби за 24 блоки в
    // 8 напрямках усі того ж біому — так не приземлятися на край регіону.
    const interior = (x, z) => {
      if (biomeAt(x, z) !== target) return false;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
        if (biomeAt(x + Math.round(Math.cos(a) * 24),
                    z + Math.round(Math.sin(a) * 24)) !== target) return false;
      }
      return true;
    };
    const ox = Math.floor(player.pos.x), oz = Math.floor(player.pos.z);
    let fallback = null;
    for (let r = 0; r <= 2400; r += 8) {
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        const x = ox + Math.round(Math.cos(a) * r);
        const z = oz + Math.round(Math.sin(a) * r);
        if (biomeAt(x, z) !== target) continue;
        if (heightAt(x, z) <= SEA + 1) continue; // уникати води
        if (!fallback) fallback = { x, z };
        if (!interior(x, z)) continue;
        player.pos.set(x + 0.5, safeSpawnY(x, z), z + 0.5);
        player.vel.set(0, 0, 0);
        return { x, z, biome: BIOME_NAMES[target] };
      }
    }
    if (fallback) { // регіон існує, але вузький — стати хоч на край
      player.pos.set(fallback.x + 0.5, safeSpawnY(fallback.x, fallback.z), fallback.z + 0.5);
      player.vel.set(0, 0, 0);
      return { ...fallback, biome: BIOME_NAMES[target], edge: true };
    }
    return null;
  },
  // Гравітація сипких блоків — інспекція з консолі для тестів.
  get falling() { return fallingBlocks.length; },
  blockAt: (x, y, z) => blockAt(x, y, z),
  // Поставити сипкий блок на `up` клітинок над поверхнею під гравцем — він
  // має впасти й приземлитися на опору. Повертає координати джерела та цілі.
  dropBlock: (id = GRAVEL, up = 5) => {
    const x = Math.floor(player.pos.x), z = Math.floor(player.pos.z);
    let gy = Math.min(HEIGHT - 1, Math.floor(player.pos.y) + 2);
    while (gy > 1 && !isSolid(blockAt(x, gy - 1, z))) gy--;  // перша порожня над опорою
    const fy = Math.min(HEIGHT - 1, gy + up);
    setBlock(x, fy, z, id);                                   // setBlock запланує падіння
    return { src: { x, y: fy, z }, expectLand: { x, y: gy, z }, name: BLOCK_NAMES[id] };
  },
  // ===== Лава: інспекція та тестування з консолі =====
  get fire() { return +player.fireTicks.toFixed(2); },        // час горіння гравця
  get lavaQueue() { return lavaQueue.size; },                 // клітинок у черзі текучості
  lavaAt: (x, y, z) => isLavaId(blockAt(x, y, z)),
  setBlock: (x, y, z, id) => { setBlock(x, y, z, id); return blockAt(x, y, z); },
  // Вилити джерело лави на `up` клітинок над поверхнею під гравцем — має потекти
  pourLava: (up = 3) => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = Math.min(HEIGHT - 1, Math.floor(player.pos.y) + 2);
    while (gy > 1 && !isSolid(blockAt(x, gy - 1, z))) gy--;
    const fy = Math.min(HEIGHT - 1, gy + up);
    setBlock(x, fy, z, LAVA);
    return { src: { x, y: fy, z }, name: BLOCK_NAMES[LAVA] };
  },
  // Оточити гравця лавою на рівні ніг (для тесту горіння) — обережно!
  igniteMe: () => {
    const x = Math.floor(player.pos.x), y = Math.floor(player.pos.y), z = Math.floor(player.pos.z);
    setBlock(x, y, z, LAVA);
    return { at: { x, y, z }, fire: player.fireTicks };
  },
  // Риболовля: керування з консолі для ручного та автоматичного тестування.
  get fishing() {
    return {
      active: fishing.active, inWater: fishing.inWater, biting: fishing.biting,
      wait: Number.isFinite(fishing.waitTimer) ? +fishing.waitTimer.toFixed(2) : null,
    };
  },
  castRod: () => { castRod(); return { active: fishing.active, inWater: fishing.inWater }; },
  // Примусово викликати клювання зараз (за потреби вважати поплавок над водою)
  forceBite: () => { fishing.inWater = true; fishing.waitTimer = 0; return { active: fishing.active }; },
  // Змотати вудку; повертає приріст їжі (риба = +5, якщо підсічка вдалась)
  reelRod: () => { const f = player.food; reelIn(); return { foodBefore: f, foodAfter: player.food }; },
  // ===== Коні: інспекція та тестування з консолі =====
  get horses() {
    return animals.filter((a) => a.type === 'horse').map((a) => ({
      tamed: a.tamed, fed: a.fedCount,
      health: +a.health.toFixed(1),
      dist: +a.pos.distanceTo(player.pos).toFixed(1),
    }));
  },
  get ridingHorse() { return !!ridingHorse; },
  // Кінь просто перед гравцем (для тестів приручення та їзди)
  spawnHorse: () => {
    const x = Math.floor(player.pos.x) + 2, z = Math.floor(player.pos.z);
    let gy = -1;
    for (let y = HEIGHT - 1; y > 0; y--) {
      if (isSolid(blockAt(x, y, z))) { gy = y; break; }
    }
    if (gy < 0) return null;
    spawnAnimal('horse', x + 0.5, gy + 1.01, z + 0.5);
    return { x: x + 0.5, y: gy + 1.01, z: z + 0.5 };
  },
  // Погодувати найближчого коня тим самим шляхом, що й ПКМ (для тестів)
  feedHorse: () => {
    const h = nearestHorse();
    if (!h) return null;
    const fed = feedHorseEntity(h);
    return { fed, tamed: h.tamed, fedCount: h.fedCount, health: +h.health.toFixed(1), food: player.food };
  },
  // Сісти верхи на найближчого коня / стан найближчого коня (для тестів)
  mountHorse: () => { const h = nearestHorse(); return h ? mountHorse(h) : false; },
  dismountHorse: () => { dismountHorse(); return !!ridingHorse; },
  horseState: () => {
    const h = ridingHorse || nearestHorse();
    if (!h) return null;
    return {
      tamed: h.tamed, fedCount: h.fedCount, riding: h === ridingHorse,
      health: +h.health.toFixed(1), state: h.state,
      speed: +Math.hypot(h.vel.x, h.vel.z).toFixed(2),
      x: +h.pos.x.toFixed(1), y: +h.pos.y.toFixed(1), z: +h.pos.z.toFixed(1),
    };
  },
  // ===== Човни: інспекція та тестування з консолі =====
  get boats() { return boats.length; },
  get riding() { return !!ridingBoat; },
  // Стан керованого (або найближчого) човна: позиція, курс, чи на воді
  get boat() {
    const b = ridingBoat || nearestBoat(1e9);
    if (!b) return null;
    return {
      x: +b.pos.x.toFixed(2), y: +b.pos.y.toFixed(2), z: +b.pos.z.toFixed(2),
      yaw: +b.yaw.toFixed(2), onWater: boatWaterSurface(b) !== null,
      speed: +Math.hypot(b.vel.x, b.vel.z).toFixed(2),
    };
  },
  giveBoat: () => { assignBlockToSlot(BOAT); return BLOCK_NAMES[BOAT]; },
  // Спустити човен просто перед гравцем (на воду чи землю) — для тестів
  placeBoatNear: () => {
    const yaw = player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const bx = Math.floor(player.pos.x + fx * 2), bz = Math.floor(player.pos.z + fz * 2);
    let sy = null;
    for (let y = Math.ceil(player.pos.y) + 2; y > Math.floor(player.pos.y) - 4; y--) {
      const id = blockAt(bx, y, bz);
      if (isWaterId(id)) { sy = y + BOAT_FLOAT; break; }
      if (isSolid(id)) { sy = y + 1 + BOAT_H; break; }
    }
    if (sy === null) sy = player.pos.y;
    const b = addBoat(bx + 0.5, sy, bz + 0.5, yaw);
    return b ? { boats: boats.length, at: MCDebug.boat } : null;
  },
  mountBoat: () => { const b = nearestBoat(1e9); return b ? mountBoat(b) : false; },
  dismount: () => { dismountBoat(); return !!ridingBoat; },
  // Дозволяє тестам натискати/відпускати клавіші руху (напр. 'KeyW')
  press: (code) => { keys[code] = true; return code; },
  release: (code) => { keys[code] = false; return code; },
};

const clock = new THREE.Clock();
let chunkTimer = 0;
let saveTimer = 5;
let waterTimer = 0;
let lavaTimer = 0;
let fpsTime = 0, fpsFrames = 0, fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive() && !player.dead && !sleeping) {
    updatePlayer(dt);
    updateSurvival(dt);
    updateAnimals(dt);
    updateMobs(dt);
    updateTnt(dt);
    updateTorches(dt);
    updateLavaLights(dt);
    updateCrops(dt);
    updateSaplings(dt);
    updateDoors(dt);
    updateGates(dt);
    if (bow.drawing) bow.charge = Math.min(1, bow.charge + dt / BOW_DRAW_TIME);
    updateArrows(dt);
    updateFallingBlocks(dt);
    updateBoats(dt);
    updateFishing(dt);
    updateParticles(dt);
    updateWeather(dt);
    waterTimer -= dt;
    if (waterTimer <= 0) {
      processWaterQueue();
      waterTimer = 0.2;
    }
    lavaTimer -= dt;
    if (lavaTimer <= 0) {
      processLavaQueue();
      lavaTimer = 0.45;   // лава тече повільніше за воду
    }
    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveGame();
      saveTimer = 5;
    }
  }

  if (gameActive()) updateSleep(dt);

  chunkTimer -= dt;
  if (chunkTimer <= 0) {
    updateChunks();
    chunkTimer = 0.3;
  }
  processChunkQueue();
  updateDayNight(dt);

  // Підсвічування блока, видобуток і анімація кирки
  const hit = gameActive() ? raycastBlock() : null;
  highlight.visible = !!hit;
  if (hit) {
    highlight.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
  }
  updateMining(dt, hit);
  updateViewModel(dt);

  // Дебаг-панель
  fpsFrames++;
  fpsTime += dt;
  if (fpsTime >= 0.5) {
    fps = Math.round(fpsFrames / fpsTime);
    fpsFrames = 0;
    fpsTime = 0;
  }
  debugEl.textContent =
    `FPS: ${fps}\n` +
    `XYZ: ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}` +
    (player.flying ? '\n✈ Політ' : '') +
    (weatherState !== 'clear' ? `\n${weatherState === 'rain' ? '🌧' : '🌨'} ${weatherState}` : '');

  updateSurvivalHud();

  // Мінімапа: важкий ресемплінг поля throttle-имо (~5 Гц), маркери — щокадру.
  if (gameActive() && minimapOn) {
    mmTimer -= dt;
    if (mmTimer <= 0) { updateMinimapField(); mmTimer = 0.18; }
    drawMinimap();
  }

  // Небо малюємо першим проходом: заливка кольором неба + сонце/місяць/зорі,
  // далі світ (з очищенням глибини), далі кирка — кожне поверх попереднього
  renderer.autoClear = false;
  renderer.setClearColor(skyColor);
  renderer.clear(true, true, true);
  skyCamera.quaternion.copy(camera.quaternion);
  renderer.render(skyScene, skyCamera);
  renderer.clearDepth();
  renderer.render(scene, camera);

  // Кирку малюємо окремим проходом поверх світу
  renderer.clearDepth();
  renderer.render(viewScene, viewCamera);
  renderer.autoClear = true;
}

animate();
