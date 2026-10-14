import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import vm from 'node:vm';

const script = readFileSync(new URL('../js/controls-search.js', import.meta.url), 'utf8');

function fixture() {
  class Element {
    constructor(tagName = 'DIV', textContent = '') {
      Object.assign(this, { tagName, textContent, children: [], hidden: false, value: '', style: { display: 'block' }, events: {} });
    }
    addEventListener(name, handler) { this.events[name] = handler; }
    dispatch(name, extra = {}) {
      let stopped = false;
      let prevented = false;
      this.events[name]?.({ key: '', ...extra, stopPropagation() { stopped = true; }, preventDefault() { prevented = true; } });
      return { stopped, prevented };
    }
    focus() { this.focused = true; }
    blur() { this.focused = false; }
  }
  const nodes = Object.fromEntries(['controls-search', 'controls-search-clear', 'controls-search-status', 'controls-search-empty', 'controls-desktop', 'controls-touch']
    .map(id => [id, new Element()]));
  nodes['controls-desktop'].children = [
    new Element('DIV', 'W — рух'),
    new Element('DIV', '🔥 Багаття — їжа'),
    new Element('DIV', '🍲 Казан — зілля'),
  ];
  nodes['controls-touch'].children = [new Element('DIV', '⬆ — стрибок'), new Element('DIV', '🍲 Казан — зілля')];
  nodes['controls-touch'].style.display = 'none';
  const window = { events: {}, addEventListener(name, handler) { this.events[name] = handler; } };
  vm.runInNewContext(script, {
    document: { getElementById(id) { return nodes[id] ?? null; } },
    window,
    getComputedStyle(element) { return element.style; },
  });
  return { nodes, window };
}

function search(nodes, query) {
  nodes['controls-search'].value = query;
  nodes['controls-search'].dispatch('input');
}

test('searches Ukrainian help entries, ignoring case and matching multiple terms', () => {
  const { nodes } = fixture();
  assert.match(nodes['controls-search-status'].textContent, /Підказок: 3/);
  search(nodes, 'КАЗАН зілля');
  assert.deepEqual(nodes['controls-desktop'].children.map(row => row.hidden), [true, true, false]);
  assert.match(nodes['controls-search-status'].textContent, /Знайдено 1 із 3/);
  assert.equal(nodes['controls-search-empty'].hidden, true);
});

test('shows an empty state and restores all entries with Escape or clear', () => {
  const { nodes } = fixture();
  search(nodes, 'невідоме');
  assert.equal(nodes['controls-search-empty'].hidden, false);
  const result = nodes['controls-search'].dispatch('keydown', { key: 'Escape' });
  assert.equal(result.stopped, true);
  assert.equal(result.prevented, true);
  assert.equal(nodes['controls-search'].value, '');
  assert.ok(nodes['controls-desktop'].children.every(row => !row.hidden));
  search(nodes, 'багаття');
  nodes['controls-search-clear'].dispatch('click');
  assert.equal(nodes['controls-search'].value, '');
  assert.equal(nodes['controls-search'].focused, true);
});

test('updates counts when switching to touch controls and isolates game keys', () => {
  const { nodes, window } = fixture();
  nodes['controls-desktop'].style.display = 'none';
  nodes['controls-touch'].style.display = 'block';
  window.events.resize();
  assert.match(nodes['controls-search-status'].textContent, /Підказок: 2/);
  search(nodes, '⬆');
  assert.deepEqual(nodes['controls-touch'].children.map(row => row.hidden), [false, true]);
  assert.equal(nodes['controls-search'].dispatch('keydown', { key: 'w' }).stopped, true);
  assert.equal(nodes['controls-search'].dispatch('keyup', { key: 'w' }).stopped, true);
});
