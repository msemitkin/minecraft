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

const BLOCK_NAMES = {
  [GRASS]: 'Трава', [DIRT]: 'Земля', [STONE]: 'Камінь', [SAND]: 'Пісок',
  [LOG]: 'Колода', [LEAVES]: 'Листя', [PLANK]: 'Дошки', [WATER]: 'Вода',
  [TNT]: 'Динаміт',
};

const HOTBAR_ITEMS = [GRASS, DIRT, STONE, SAND, LOG, LEAVES, PLANK, WATER, TNT];

const isWaterId = (id) => id === WATER || (id >= FLOW3 && id <= FLOW1);
const isSolid = (id) => id !== AIR && !isWaterId(id);
// Рівень води: джерело = 4, потоки = 3..1
const WATER_LEVEL = { [WATER]: 4, [FLOW3]: 3, [FLOW2]: 2, [FLOW1]: 1 };
const FLOW_OF_LEVEL = { 3: FLOW3, 2: FLOW2, 1: FLOW1 };

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

function saveGame() {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({
      edits: [...edits],
      player: {
        x: player.pos.x, y: player.pos.y, z: player.pos.z,
        yaw: player.yaw, pitch: player.pitch,
      },
      timeOfDay,
      selectedSlot,
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
        else id = STONE;
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

// ===== Гравець =====
const PLAYER_W = 0.3;   // пів-ширини
const PLAYER_H = 1.8;
const EYE = 1.62;
const EPS = 0.001;

const player = {
  pos: new THREE.Vector3(8.5, heightAt(8, 8) + 2, 8.5),
  vel: new THREE.Vector3(),
  yaw: 0,
  pitch: 0,
  onGround: false,
  halfW: PLAYER_W,
  height: PLAYER_H,
};

if (savedGame && savedGame.player) {
  const p = savedGame.player;
  if ([p.x, p.y, p.z].every(Number.isFinite)) {
    player.pos.set(p.x, p.y, p.z);
    player.yaw = p.yaw || 0;
    player.pitch = p.pitch || 0;
  }
}

const keys = {};
let selectedSlot = 0;

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
    if (keys['Space'] && player.onGround) player.vel.y = 8.2;
  }

  player.onGround = false;
  moveEntityAxis(player, 'y', player.vel.y * dt);
  moveEntityAxis(player, 'x', player.vel.x * dt);
  moveEntityAxis(player, 'z', player.vel.z * dt);

  // Якщо провалилися під світ — повернути на поверхню
  if (player.pos.y < -10) {
    player.pos.set(player.pos.x, HEIGHT, player.pos.z);
    player.vel.set(0, 0, 0);
  }

  camera.position.set(player.pos.x, player.pos.y + EYE, player.pos.z);
  camera.rotation.set(player.pitch, player.yaw, 0, 'YXZ');
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
    speed: 1.4, halfW: 0.32, height: 0.95,
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
    speed: 1.1, halfW: 0.38, height: 1.3,
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
    speed: 1.7, halfW: 0.2, height: 0.7,
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
  animals.push({
    type, group, legs,
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

  // Плавний поворот до цільового напрямку
  let dyaw = a.targetYaw - a.yaw;
  dyaw = ((dyaw + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI;
  a.yaw += dyaw * Math.min(1, dt * 3);

  const moving = a.state === 'walk';
  const sp = moving ? a.speed : 0;
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
  primedTnt.push({ mesh, x, y, z, timer: fuse });
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

function explode(cx, cy, cz) {
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

  knockback(player, cx, cy, cz);
  for (const a of animals) knockback(a, cx, cy, cz);

  // Спалах вибуху
  const fx = new THREE.Mesh(
    new THREE.SphereGeometry(1, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.9 })
  );
  fx.position.set(cx, cy, cz);
  scene.add(fx);
  explosionFx.push({ mesh: fx, t: 0 });
}

function updateTnt(dt) {
  for (let i = primedTnt.length - 1; i >= 0; i--) {
    const t = primedTnt[i];
    t.timer -= dt;
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

function breakBlock() {
  const hit = raycastBlock();
  if (!hit) return;
  const [x, y, z] = hit.block;
  if (blockAt(x, y, z) === TNT) {
    igniteTnt(x, y, z); // удар по динаміту підпалює його
    return;
  }
  setBlock(x, y, z, AIR);
}

function placeBlock() {
  const hit = raycastBlock();
  if (!hit || !hit.prev) return;
  const [x, y, z] = hit.prev;
  const target = blockAt(x, y, z);
  if (target !== AIR && !isWaterId(target)) return;

  // Не ставити блок усередину гравця
  const p = player.pos;
  const overlapX = x + 1 > p.x - PLAYER_W && x < p.x + PLAYER_W;
  const overlapY = y + 1 > p.y && y < p.y + PLAYER_H;
  const overlapZ = z + 1 > p.z - PLAYER_W && z < p.z + PLAYER_W;
  if (overlapX && overlapY && overlapZ) return;

  setBlock(x, y, z, HOTBAR_ITEMS[selectedSlot]);
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

  sun.position.set(Math.cos(angle) * 100, sunHeight * 100, 30);
  sun.intensity = Math.max(0, sunHeight) * 1.2;

  const day = THREE.MathUtils.clamp((sunHeight + 0.2) / 0.6, 0.05, 1);
  hemi.intensity = 0.15 + day * 0.75;

  skyColor.lerpColors(nightColor, dayColor, day);
  scene.background = skyColor;
  scene.fog.color.copy(skyColor);
}

// ===== HUD =====
const overlay = document.getElementById('overlay');
const hud = document.getElementById('hud');
const itemNameEl = document.getElementById('item-name');
const debugEl = document.getElementById('debug');
let itemNameTimer = null;

function buildHotbar() {
  const hotbar = document.getElementById('hotbar');
  HOTBAR_ITEMS.forEach((id, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot' + (i === 0 ? ' selected' : '');
    const num = document.createElement('span');
    num.className = 'num';
    num.textContent = i + 1;
    const icon = document.createElement('canvas');
    icon.width = TILE;
    icon.height = TILE;
    const tile = BLOCK_TILES[id].side;
    icon.getContext('2d').drawImage(
      atlasCanvas,
      (tile % ATLAS_COLS) * TILE, Math.floor(tile / ATLAS_COLS) * TILE, TILE, TILE,
      0, 0, TILE, TILE
    );
    slot.append(num, icon);
    slot.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      selectSlot(i);
    });
    hotbar.appendChild(slot);
  });
}

function selectSlot(i) {
  selectedSlot = ((i % HOTBAR_ITEMS.length) + HOTBAR_ITEMS.length) % HOTBAR_ITEMS.length;
  document.querySelectorAll('.slot').forEach((el, j) =>
    el.classList.toggle('selected', j === selectedSlot));
  itemNameEl.textContent = BLOCK_NAMES[HOTBAR_ITEMS[selectedSlot]];
  itemNameEl.style.opacity = 1;
  clearTimeout(itemNameTimer);
  itemNameTimer = setTimeout(() => { itemNameEl.style.opacity = 0; }, 1200);
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
  overlay.style.display = 'flex';
  hud.hidden = true;
  touchControls.hidden = true;
}

document.getElementById('play-btn').addEventListener('click', () => {
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
  } else if (!mobilePlaying) {
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

let breakRepeat = null;
bindTouchButton('btn-break',
  () => {
    breakBlock();
    breakRepeat = setInterval(breakBlock, 300);
  },
  () => clearInterval(breakRepeat));

bindTouchButton('btn-place', () => placeBlock());

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
  if (!isLocked()) return;
  if (e.button === 0) breakBlock();
  if (e.button === 2) placeBlock();
});

document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  keys[e.code] = true;
  if (e.code === 'Space') e.preventDefault();
  if (e.code.startsWith('Digit')) {
    const n = Number(e.code.slice(5));
    if (n >= 1 && n <= HOTBAR_ITEMS.length) selectSlot(n - 1);
  }
});

document.addEventListener('keyup', (e) => { keys[e.code] = false; });

document.addEventListener('wheel', (e) => {
  if (isLocked()) selectSlot(selectedSlot + Math.sign(e.deltaY));
});

addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
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
  clearSave();
  location.reload();
});

// Зберегти, коли вкладку згортають або закривають
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') saveGame();
});
addEventListener('pagehide', saveGame);

// ===== Головний цикл =====
buildHotbar();
if (savedGame && Number.isInteger(savedGame.selectedSlot)) {
  selectSlot(savedGame.selectedSlot);
}
const clock = new THREE.Clock();
let chunkTimer = 0;
let saveTimer = 5;
let waterTimer = 0;
let fpsTime = 0, fpsFrames = 0, fps = 0;

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(clock.getDelta(), 0.05);

  if (gameActive()) {
    updatePlayer(dt);
    updateAnimals(dt);
    updateTnt(dt);
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

  // Підсвічування блока
  const hit = gameActive() ? raycastBlock() : null;
  highlight.visible = !!hit;
  if (hit) {
    highlight.position.set(hit.block[0] + 0.5, hit.block[1] + 0.5, hit.block[2] + 0.5);
  }

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
    `XYZ: ${player.pos.x.toFixed(1)} ${player.pos.y.toFixed(1)} ${player.pos.z.toFixed(1)}`;

  renderer.render(scene, camera);
}

animate();
