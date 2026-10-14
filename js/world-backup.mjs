// Portable MineClone world backups. No external assets or dependencies.
export const BACKUP_FORMAT = 'mineclone-world-backup';
export const BACKUP_VERSION = 1;
export const MAX_BACKUP_BYTES = 20 * 1024 * 1024;

const ARRAY_FIELDS = [
  'torches', 'crops', 'saplings', 'beds', 'signs', 'ladders', 'doors',
  'fences', 'gates', 'boats', 'rails', 'carts', 'campfires', 'beehives',
  'scarecrows', 'anvils', 'mills', 'cauldrons', 'lightningRods', 'plates',
  'notes', 'levers', 'wires', 'lamps', 'sensors', 'inverters', 'buttons',
  'latches', 'turrets', 'bells', 'pistons', 'fans', 'sluices', 'harvesters',
  'feeders', 'porters', 'collectors', 'shearers', 'grinders', 'bakers',
  'observers', 'targets', 'tripwires', 'chests', 'mushrooms', 'flowers',
  'oysters', 'cactusFruits', 'wolves', 'horses', 'golems', 'leashed',
  'night', 'traderOffers', 'villagerOffers', 'hotbar',
];
const isObject = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

export function validateWorld(world) {
  if (!isObject(world) || !Array.isArray(world.edits) || !isObject(world.player)) {
    throw new Error('Файл не містить коректного збереження MineClone.');
  }
  for (const field of ['x', 'y', 'z', 'yaw', 'pitch']) {
    if (!Number.isFinite(world.player[field])) {
      throw new Error('Пошкоджені координати або напрямок гравця.');
    }
  }
  for (const entry of world.edits) {
    if (!Array.isArray(entry) || entry.length !== 2 ||
        typeof entry[0] !== 'string' || !/^-?\d+,-?\d+,-?\d+$/.test(entry[0]) ||
        !Number.isInteger(entry[1]) || entry[1] < 0 || entry[1] > 255) {
      throw new Error('Пошкоджені дані блоків у збереженні.');
    }
  }
  for (const field of ARRAY_FIELDS) {
    if (world[field] !== undefined && !Array.isArray(world[field])) {
      throw new Error('Пошкоджений розділ збереження: ' + field + '.');
    }
  }
  if (world.weather !== undefined && !isObject(world.weather)) {
    throw new Error('Пошкоджені дані погоди.');
  }
  return world;
}

export function createBackup(world, seed, saveVersion, exportedAt = new Date().toISOString()) {
  validateWorld(world);
  const text = JSON.stringify({
    format: BACKUP_FORMAT, version: BACKUP_VERSION, seed, saveVersion, exportedAt, world,
  });
  if (new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Світ завеликий для резервної копії (ліміт 20 МБ).');
  }
  return text;
}

export function parseBackup(text, seed, saveVersion) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES) {
    throw new Error('Файл завеликий для імпорту (ліміт 20 МБ).');
  }
  let backup;
  try { backup = JSON.parse(text); }
  catch { throw new Error('Не вдалося прочитати JSON-файл.'); }
  if (!isObject(backup) || backup.format !== BACKUP_FORMAT ||
      backup.version !== BACKUP_VERSION) {
    throw new Error('Невідомий формат або версія резервної копії.');
  }
  if (backup.seed !== seed || backup.saveVersion !== saveVersion) {
    throw new Error('Копія належить іншому світу або версії генератора.');
  }
  return validateWorld(backup.world);
}

export function installBackupUI({ saveGame, saveKey, seed, saveVersion, disableSave }) {
  const exportButton = document.getElementById('export-world-btn');
  const importButton = document.getElementById('import-world-btn');
  const fileInput = document.getElementById('backup-file-input');
  const status = document.getElementById('backup-status');
  function show(message, error = false) {
    status.textContent = message;
    status.classList.toggle('error', error);
  }
  exportButton.addEventListener('click', () => {
    try {
      // Capture live state, not the previous autosave.
      if (!saveGame()) throw new Error('Не вдалося зберегти світ у браузері.');
      const raw = localStorage.getItem(saveKey);
      if (!raw) throw new Error('Збереження не знайдено.');
      const text = createBackup(JSON.parse(raw), seed, saveVersion);
      const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `mineclone-${seed}-${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      show('Резервну копію світу завантажено.');
    } catch (error) {
      show(error.message || 'Не вдалося експортувати світ.', true);
    }
  });
  importButton.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = ''; // Allow retrying the same file.
    if (!file) return;
    try {
      if (file.size > MAX_BACKUP_BYTES) {
        throw new Error('Файл завеликий для імпорту (ліміт 20 МБ).');
      }
      const world = parseBackup(await file.text(), seed, saveVersion);
      if (!window.confirm('Замінити поточний світ резервною копією? Поточне збереження буде перезаписано.')) {
        show('Імпорт скасовано — поточний світ не змінено.');
        return;
      }
      // setItem is atomic: quota failures do not destroy the previous save.
      localStorage.setItem(saveKey, JSON.stringify(world));
      // Prevent pagehide/visibilitychange from restoring the old world.
      disableSave();
      window.location.reload();
    } catch (error) {
      show(error.message || 'Не вдалося відновити світ.', true);
    }
  });
}
