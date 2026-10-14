import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const css = readFileSync(new URL('../css/style.css', import.meta.url), 'utf8');
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');

test('touch HUD starts hidden in HTML', () => {
  assert.match(html, /id="touch-controls"\s+hidden/);
});

test('touch HUD is hidden by default even when JS removes hidden', () => {
  assert.match(css, /#touch-controls\s*\{\s*display:\s*none\s*!important;/);
});

test('only touch-only primary pointers can display the HUD', () => {
  assert.match(css, /@media\s*\(hover:\s*none\)\s*and\s*\(pointer:\s*coarse\)\s*\{\s*#touch-controls:not\(\[hidden\]\)\s*\{\s*display:\s*block\s*!important;/);
});
