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

const BLOCK_NAMES = {
  [GRASS]: 'Трава', [DIRT]: 'Земля', [STONE]: 'Камінь', [SAND]: 'Пісок',
  [LOG]: 'Колода', [LEAVES]: 'Листя', [PLANK]: 'Дошки', [WATER]: 'Вода',
  [TNT]: 'Динаміт',
  [COAL]: 'Вугільна руда', [IRON]: 'Залізна руда',
  [GOLD]: 'Золота руда', [DIAMOND]: 'Алмазна руда',
  [TORCH]: 'Смолоскип', [SEEDS]: 'Насіння', [BOW]: 'Лук',
};

// Усі блоки, доступні для встановлення — показуються в меню вибору (Tab)
const ALL_BLOCKS = [
  GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANK, WATER, TNT,
  COAL, IRON, GOLD, DIAMOND, TORCH, SEEDS, BOW,
];

// Хотбар: 10 слотів швидкого доступу (клавіші 1–9 та 0).
// Блоки, які не вмістилися, доступні через меню (Tab) і призначаються в слот.
const HOTBAR_SIZE = 10;
const DEFAULT_HOTBAR = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANK, WATER, TNT, TORCH];

const isWaterId = (id) => id === WATER || (id >= FLOW3 && id <= FLOW1);
const isSolid = (id) => id !== AIR && !isWaterId(id);
// Рівень води: джерело = 4, потоки = 3..1
const WATER_LEVEL = { [WATER]: 4, [FLOW3]: 3, [FLOW2]: 2, [FLOW1]: 1 };
const FLOW_OF_LEVEL = { 3: FLOW3, 2: FLOW2, 1: FLOW1 };

// Скільки секунд утримувати ЛКМ, щоб видобути блок
const BLOCK_HARDNESS = {
  [GRASS]: 0.5, [DIRT]: 0.5, [SAND]: 0.55,
  [LEAVES]: 0.3, [LOG]: 1.0, [PLANK]: 0.9, [STONE]: 1.6,
  [COAL]: 2.2, [IRON]: 2.8, [GOLD]: 2.8, [DIAMOND]: 3.6,
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

const treeAt = (x, z) => ihash(x + 39163, z - 21577) < 0.02;

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
// v3: версія генератора (печери + нові висоти) — старі сейви несумісні
const SAVE_KEY = `mineclone:${SEED}:v3`;

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
      },
      timeOfDay,
      weather: { state: weatherState, timer: weatherTimer, intensity: weatherIntensity },
      torches: [...torches.values()].map((t) => [t.x, t.y, t.z, t.face, t.dx, t.dz]),
      crops: [...crops.values()].map((c) => [c.x, c.y, c.z, c.stage, +c.growth.toFixed(2)]),
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
    eat() {
      // Два приглушені «хрусти» поспіль — звук жування
      noise({ dur: 0.09, gain: 0.16, type: 'lowpass', freq: 500, q: 0.8 });
      tone({ freq: 180, dur: 0.1, type: 'triangle', gain: 0.08, slideTo: 120 });
      setTimeout(() => {
        if (!enabled) return;
        noise({ dur: 0.08, gain: 0.13, type: 'lowpass', freq: 560, q: 0.8 });
      }, 130);
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
      const noCaves = h <= SEA + 1; // не дірявити дно озер і пляжі
      for (let y = 0; y <= h; y++) {
        if (!noCaves && caveAt(wx, y, wz, h)) continue;
        let id;
        if (y === h) id = h <= SEA + 1 ? SAND : GRASS;
        else if (y > h - 4) id = DIRT;
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
// Текстурний атлас (малюється на canvas, без зовнішніх файлів)
// ============================================================
const TILE = 16, ATLAS_COLS = 4, ATLAS_ROWS = 4;
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

  for (let ly = 0; ly < HEIGHT; ly++) {
    for (let lz = 0; lz < CHUNK; lz++) {
      for (let lx = 0; lx < CHUNK; lx++) {
        const id = data[blockIndex(lx, ly, lz)];
        if (id === AIR) continue;
        const wx = wx0 + lx, wz = wz0 + lz;

        for (const { dir, face, verts } of FACES) {
          const nb = blockAt(wx + dir[0], ly + dir[1], wz + dir[2]);
          const visible = isWaterId(id)
            ? nb === AIR
            : nb === AIR || isWaterId(nb);
          if (!visible) continue;

          const buf = isWaterId(id) ? water : solid;
          const { u0, u1, v0, v1 } = tileUV(BLOCK_TILES[id][face]);
          const uvCorners = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
          const base = buf.pos.length / 3;

          for (let i = 0; i < 4; i++) {
            const v = verts[i];
            // Верх води трохи нижче, щоб було видно поверхню
            const yOff = isWaterId(id) && v[1] === 1 ? -0.12 : 0;
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
  };
}

function disposeChunkMesh(entry, scene) {
  for (const mesh of [entry.solid, entry.water]) {
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
  // Перемикання між киркою та луком за активним предметом хотбара
  const holdingBow = hotbar[selectedSlot] === BOW;
  viewModel.visible = !holdingBow;
  bowView.group.visible = holdingBow;
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
  sinceHurt: 999,   // секунд від останньої шкоди (для регенерації)
  regenTick: 0,
  drownTick: 0,
  fallPeakY: 0,     // найвища точка під час падіння
  prevOnGround: true,
  prevInWater: false, // для звуку сплеску при зануренні
  stepDist: 0,      // накопичена відстань для звуку кроків
  lastCause: '',
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
        if (!isSolid(blockAt(x, y, z))) continue;
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

function updatePlayer(dt) {
  const inWater = isWaterId(blockAt(
    Math.floor(player.pos.x),
    Math.floor(player.pos.y + 0.4),
    Math.floor(player.pos.z)
  ));

  // Горизонтальний рух
  const speed = keys['ShiftLeft'] || keys['ShiftRight'] ? 8 : 5;
  let fx = 0, fz = 0;
  if (keys['KeyW']) fz -= 1;
  if (keys['KeyS']) fz += 1;
  if (keys['KeyA']) fx -= 1;
  if (keys['KeyD']) fx += 1;
  if (joy.active) { fx = joy.x; fz = joy.y; }
  const len = Math.hypot(fx, fz);
  if (len > 1) { fx /= len; fz /= len; }

  const sin = Math.sin(player.yaw), cos = Math.cos(player.yaw);
  player.vel.x = (fx * cos + fz * sin) * speed * (inWater ? 0.6 : 1);
  player.vel.z = (-fx * sin + fz * cos) * speed * (inWater ? 0.6 : 1);

  // Вертикальний рух
  if (inWater) {
    player.vel.y = keys['Space'] ? 4 : Math.max(player.vel.y - 12 * dt, -2.5);
  } else {
    player.vel.y -= 24 * dt;
    player.vel.y = Math.max(player.vel.y, -50);
    if (keys['Space'] && player.onGround) {
      player.vel.y = 8.2; Sound.jump();
      player.exhaustion += keys['ShiftLeft'] || keys['ShiftRight'] ? 0.8 : 0.2;
    }
  }

  // Звук сплеску при зануренні у воду
  if (inWater && !player.prevInWater) Sound.splash();
  player.prevInWater = inWater;

  player.onGround = false;
  moveEntityAxis(player, 'y', player.vel.y * dt);
  moveEntityAxis(player, 'x', player.vel.x * dt);
  moveEntityAxis(player, 'z', player.vel.z * dt);

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
  if (player.onGround && !inWater) {
    player.stepDist += Math.hypot(player.vel.x, player.vel.z) * dt;
    if (player.stepDist > 2.4) {
      player.stepDist = 0;
      if (isSolid(groundId)) Sound.step(groundId);
    }
  } else {
    player.stepDist = 0;
  }

  // Шкода від падіння: рахуємо висоту арки між відривом і приземленням
  if (player.onGround) {
    if (!player.prevOnGround) {
      const fall = player.fallPeakY - player.pos.y;
      if (!inWater && fall > 0.4) Sound.land(); // звук приземлення
      if (fall > FALL_SAFE && !inWater) {
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
  mining = false;
  cancelBowDraw();
  resetMining();
  if (isLocked()) document.exitPointerLock();
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
  player.sinceHurt = 999;
  player.dead = false;
  const sy = safeSpawnY(SPAWN.x, SPAWN.z);
  player.pos.set(SPAWN.x + 0.5, sy, SPAWN.z + 0.5);
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
}

// Зʼїсти одну порцію сирого м'яса (клавіша F / кнопка 🍖)
function eatFood() {
  if (player.dead || player.eatTimer > 0) return;
  if (player.food <= 0 || player.hunger >= MAX_HUNGER) return;
  player.food -= 1;
  player.hunger = Math.min(MAX_HUNGER, player.hunger + EAT_AMOUNT);
  player.eatTimer = EAT_COOLDOWN;
  Sound.eat();
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
};

function spawnAnimal(type, x, y, z) {
  const def = ANIMAL_TYPES[type];
  const group = new THREE.Group();
  const legs = def.build(group);
  group.position.set(x, y, z);
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
  if (blockAt(x, h, z) !== GRASS) return;      // лише на траві
  if (isSolid(blockAt(x, h + 1, z))) return;   // місце вільне
  const types = Object.keys(ANIMAL_TYPES);
  spawnAnimal(types[Math.floor(Math.random() * types.length)], x + 0.5, h + 1.01, z + 0.5);
}

function removeAnimal(index) {
  const a = animals[index];
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
  // Паніка після удару: тікає геть від гравця прискорено
  const panicking = a.panic > 0;
  if (panicking) {
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

  // Плавний поворот до цільового напрямку (швидше в паніці)
  let dyaw = a.targetYaw - a.yaw;
  dyaw = ((dyaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  a.yaw += dyaw * Math.min(1, dt * (panicking ? 8 : 3));

  const moving = panicking || a.state === 'walk';
  const sp = moving ? a.speed * (panicking ? 2.2 : 1) : 0;
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

  // Анімація ніг
  if (moving && (a.onGround || inWater)) {
    a.legPhase += dt * 9;
  }
  const swing = Math.sin(a.legPhase) * 0.55 * (moving ? 1 : 0);
  a.legs.forEach((leg, i) => {
    leg.rotation.x = i % 2 === 0 ? swing : -swing;
  });

  // Червоний спалах при отриманні удару
  if (a.hurt > 0) {
    a.hurt = Math.max(0, a.hurt - dt * 3);
    for (const mat of a.mats) mat.emissive.setRGB(a.hurt * 0.6, 0, 0);
  }

  a.group.position.copy(a.pos);
  a.group.rotation.y = a.yaw;
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
    if (a.pos.distanceTo(player.pos) > ANIMAL_DESPAWN_DIST || a.pos.y < -10) {
      removeAnimal(i);
    } else {
      updateAnimal(a, dt);
    }
  }
}

// ============================================================
// Вороги: зомбі (з'являються вночі, переслідують і б'ють гравця)
// ============================================================
const MOB_MAX = 6;
const MOB_DESPAWN_DIST = 80;
let dayNightSun = 1; // оновлюється в updateDayNight: 1 — полудень, -1 — північ

const ZOMBIE_COLOR = new THREE.Color(0x4f7a44);
const CREEPER_COLOR = new THREE.Color(0x5fa64d);
const SMOKE_COLOR = new THREE.Color(0x4a4a4a);
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

function spawnMob(x, y, z, type = 'zombie') {
  const group = new THREE.Group();
  const isCreeper = type === 'creeper';
  const built = isCreeper ? buildCreeper(group) : buildZombie(group);
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
    speed: isCreeper ? 2.6 : 2.2,
    onGround: false,
    legPhase: 0,
    health: isCreeper ? 10 : 14,
    hurt: 0,        // спалах при ударі (0..1)
    attackCD: 0,    // перезарядка атаки
    attackAnim: 0,  // мах руками при ударі
    burn: 0,        // час горіння під сонцем
    fuse: 0,        // кріпер: час, що лишився до вибуху (0 — ґніт не горить)
    detonated: false,
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
  // Десь третина нічної нечисті — кріпери (тихі підривники)
  spawnMob(x + 0.5, h + 1.01, z + 0.5, Math.random() < 0.33 ? 'creeper' : 'zombie');
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

function updateMob(m, dt) {
  const isCreeper = m.type === 'creeper';

  // Удень зомбі займаються вогнем і швидко гинуть; кріпери — ні (загроза вдень)
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

  const moving = chase && distH > 1.0 && !fusing;
  const sp = moving ? m.speed : 0;
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

  // Атака при контакті (лише зомбі; кріпер шкодить вибухом)
  if (m.attackCD > 0) m.attackCD -= dt;
  if (!isCreeper) {
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
      const near = mobs.some((m) => m.type !== 'creeper' && m.pos.distanceTo(player.pos) < 22);
      if (near) Sound.mobGroan();
      groanTimer = 2.5 + Math.random() * 4;
    }
  }
  for (let i = mobs.length - 1; i >= 0; i--) {
    const m = mobs[i];
    if (m.health <= 0) {
      if (!m.detonated) {                            // кріпер, що вибухнув, уже дав ефекти
        const isCreeper = m.type === 'creeper';
        spawnParticles(m.pos.x, m.pos.y + 0.9, m.pos.z,
          isCreeper ? CREEPER_COLOR : ZOMBIE_COLOR, 16,
          { radius: 0.4, speed: 3, upBias: 1.2, life: 0.7, size: 0.13 });
        Sound.mobDeath();
      }
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
const _atkDir = new THREE.Vector3();

// Удар гравця по найближчій істоті в прицілі (зомбі або тварині).
// Зомбі гинуть у updateMobs; тварини — тут, лишаючи сире м'ясо.
function tryAttack() {
  if (!mobs.length && !animals.length) return false;
  camera.getWorldDirection(_atkDir);
  const ox = camera.position.x, oy = camera.position.y, oz = camera.position.z;
  let best = null, bestDist = Infinity, bestIsAnimal = false;
  const consider = (e, isAnimal) => {
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
  for (const a of animals) consider(a, true);
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
  if (tryAttack()) return;
  // Зняти смолоскип або зібрати посів, якщо дивимось на нього (клітинка перед блоком)
  if (torches.size > 0 || crops.size > 0) {
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
      const crop = crops.get(key);
      if (crop) {
        harvestCrop(crop);
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
  };
  group.position.copy(a.pos);
  orientArrow(a);
  scene.add(group);
  arrows.push(a);
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
    if (check(an)) { damageEntity(an, true, a.dmg, a.vel.x, a.vel.z, 3); return true; }
  }
  return false;
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
      if (arrowHitEntity(a)) { outcome = 'entity'; break; }
      const bid = blockAt(Math.floor(a.pos.x), Math.floor(a.pos.y), Math.floor(a.pos.z));
      if (isSolid(bid)) {
        outcome = 'block';
        Sound.arrowHit();
        spawnParticles(a.pos.x, a.pos.y, a.pos.z, blockColor(bid), 4,
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
  if (blockAt(x, y, z) !== AIR || torches.has(torchKey(x, y, z))) return false;
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
  if (crops.has(cropKey(x, y, z)) || torches.has(torchKey(x, y, z))) return false;
  if (!cropSupportable(blockAt(x, y - 1, z))) return false;  // лише на грунті
  if (!addCrop(x, y, z)) return false;
  Sound.dig(GRASS);                                          // м'який звук грунту
  spawnParticles(x + 0.5, y + 0.06, z + 0.5, new THREE.Color(0x6b4a2b), 7,
    { radius: 0.3, speed: 1.5, upBias: 0.5, life: 0.45, size: 0.09, gravity: 10 });
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
    resetMining();
    return;
  }

  // Показати тріщини відповідної стадії
  const stage = Math.min(CRACK_STAGES - 1, Math.floor(miningState.progress * CRACK_STAGES));
  crackTexture.offset.x = stage / CRACK_STAGES;
  crackMesh.position.set(x + 0.5, y + 0.5, z + 0.5);
  crackMesh.visible = true;
}

function placeBlock() {
  if (hotbar[selectedSlot] === BOW) return;   // луком не ставлять блок
  triggerSwing();
  const hit = raycastBlock();
  if (!hit || !hit.prev) return;

  const id = hotbar[selectedSlot];

  // Смолоскип — особлива сутність: ставиться на опору, не змінює воксельну сітку
  if (id === TORCH) {
    placeTorch(hit);
    return;
  }

  // Насіння — сутність-посів: садиться на траву/землю, не змінює воксельну сітку
  if (id === SEEDS) {
    plantCrop(hit);
    return;
  }

  const [x, y, z] = hit.prev;
  const target = blockAt(x, y, z);
  if (target !== AIR && !isWaterId(target)) return;

  // Не ставити блок усередину гравця
  const p = player.pos;
  const overlapX = x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W;
  const overlapY = y + 1 > p.y && y < p.y + PLAYER_H;
  const overlapZ = z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W;
  if (overlapX && overlapY && overlapZ) return;

  setBlock(x, y, z, id);
  Sound.place(id);
  // Невеликий пил при встановленні блока
  spawnParticles(x + 0.5, y + 0.5, z + 0.5, blockColor(id), 6,
    { radius: 0.5, speed: 1.4, upBias: 0.3, life: 0.4, size: 0.1, gravity: 10 });
  validateTorches();  // блок міг зайняти клітинку смолоскипа
  validateCrops();    // ... або клітинку посіву
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
}

const DEATH_CAUSES = {
  fall: 'Падіння з висоти',
  drown: 'Потонув',
  tnt: 'Підірвався на динаміті',
  zombie: 'Розтерзаний зомбі',
  creeper: 'Підірваний кріпером',
  starve: 'Помер від голоду',
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
  } else if (!mobilePlaying && !blockMenuOpen && !player.dead) {
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

bindTouchButton('btn-jump', () => { keys['Space'] = true; }, () => { keys['Space'] = false; });

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

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code === 'Tab') {
    e.preventDefault();
    toggleBlockMenu();
    return;
  }
  if (e.code === 'KeyM') { Sound.resume(); applySoundState(Sound.toggle()); return; }
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
};

const clock = new THREE.Clock();
let chunkTimer = 0;
let saveTimer = 5;
let waterTimer = 0;
let fpsTime = 0, fpsFrames = 0, fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive() && !player.dead) {
    updatePlayer(dt);
    updateSurvival(dt);
    updateAnimals(dt);
    updateMobs(dt);
    updateTnt(dt);
    updateTorches(dt);
    updateCrops(dt);
    if (bow.drawing) bow.charge = Math.min(1, bow.charge + dt / BOW_DRAW_TIME);
    updateArrows(dt);
    updateParticles(dt);
    updateWeather(dt);
    waterTimer -= dt;
    if (waterTimer <= 0) {
      processWaterQueue();
      waterTimer = 0.2;
    }
    saveTimer -= dt;
    if (saveTimer <= 0) {
      saveGame();
      saveTimer = 5;
    }
  }

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
    (weatherState !== 'clear' ? `\n${weatherState === 'rain' ? '🌧' : '🌨'} ${weatherState}` : '');

  updateSurvivalHud();

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
