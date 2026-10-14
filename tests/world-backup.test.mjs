import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BACKUP_FORMAT, BACKUP_VERSION, MAX_BACKUP_BYTES,
  createBackup, parseBackup, validateWorld,
} from '../js/world-backup.mjs';

const SEED = 20260610, VERSION = 'v4';
const world = () => ({
  edits: [['1,26,-3', 4], ['0,20,0', 0]],
  player: { x: 1.5, y: 30, z: -3.5, yaw: 1, pitch: -0.2, health: 20 },
  torches: [[1, 27, -3, 0, 0, 0]],
  chests: [[2, 26, -3, [['wheat', 12]]]],
  hotbar: [1, 2, 3],
});

test('round-trips a complete world without dropping nested inventories', () => {
  const original = world();
  const text = createBackup(original, SEED, VERSION, '2026-10-14T00:00:00.000Z');
  const envelope = JSON.parse(text);
  assert.equal(envelope.format, BACKUP_FORMAT);
  assert.equal(envelope.version, BACKUP_VERSION);
  assert.equal(envelope.exportedAt, '2026-10-14T00:00:00.000Z');
  assert.deepEqual(parseBackup(text, SEED, VERSION), original);
});

test('rejects malformed JSON and unknown backup formats', () => {
  assert.throws(() => parseBackup('{', SEED, VERSION), /JSON/);
  const data = JSON.parse(createBackup(world(), SEED, VERSION));
  data.format = 'other';
  assert.throws(() => parseBackup(JSON.stringify(data), SEED, VERSION), /формат/);
  data.format = BACKUP_FORMAT;
  data.version = 999;
  assert.throws(() => parseBackup(JSON.stringify(data), SEED, VERSION), /версія|версії/);
});

test('rejects a backup from a different seed or save version', () => {
  const text = createBackup(world(), SEED, VERSION);
  assert.throws(() => parseBackup(text, SEED + 1, VERSION), /іншому світу/);
  assert.throws(() => parseBackup(text, SEED, 'v5'), /версії генератора/);
});

test('rejects missing world state, invalid player coordinates and corrupt edits', () => {
  assert.throws(() => validateWorld({}), /збереження/);
  const invalidPos = world(); invalidPos.player.x = Infinity;
  assert.throws(() => validateWorld(invalidPos), /координати/);
  const invalidEdit = world(); invalidEdit.edits = [['not-a-position', 7]];
  assert.throws(() => validateWorld(invalidEdit), /блоків/);
  const invalidId = world(); invalidId.edits = [['1,2,3', 256]];
  assert.throws(() => validateWorld(invalidId), /блоків/);
});

test('rejects corrupt optional collections and weather', () => {
  const badChests = world(); badChests.chests = {};
  assert.throws(() => validateWorld(badChests), /chests/);
  const badWeather = world(); badWeather.weather = [];
  assert.throws(() => validateWorld(badWeather), /погоди/);
});

test('rejects oversized files before parsing', () => {
  assert.throws(() => parseBackup('x'.repeat(MAX_BACKUP_BYTES + 1), SEED, VERSION), /20 МБ/);
});

test('round-trips Unicode sign text', () => {
  const original = world();
  original.signs = [[1, 27, -3, 0, 'Привіт, світ! 🌍']];
  assert.deepEqual(parseBackup(createBackup(original, SEED, VERSION), SEED, VERSION), original);
});
