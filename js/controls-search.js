// Search the desktop and touch control guides without touching the game loop.
(() => {
  'use strict';

  const input = document.getElementById('controls-search');
  const clearButton = document.getElementById('controls-search-clear');
  const status = document.getElementById('controls-search-status');
  const empty = document.getElementById('controls-search-empty');
  const guides = ['controls-desktop', 'controls-touch']
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!input || !clearButton || !status || !empty || guides.length === 0) return;

  const normalize = text => text.normalize('NFKC').toLocaleLowerCase('uk-UA')
    .replace(/\s+/g, ' ').trim();
  const groups = guides.map(guide => ({
    guide,
    rows: Array.from(guide.children)
      .filter(row => row.tagName === 'DIV')
      .map(row => ({ element: row, text: normalize(row.textContent) })),
  }));

  function update() {
    const terms = normalize(input.value).split(' ').filter(Boolean);
    let matches = 0;
    let total = 0;
    for (const { guide, rows } of groups) {
      for (const { element, text } of rows) {
        element.hidden = !terms.every(term => text.includes(term));
      }
      if (getComputedStyle(guide).display !== 'none') {
        total += rows.length;
        matches += rows.filter(({ element }) => !element.hidden).length;
      }
    }
    clearButton.hidden = input.value.length === 0;
    status.textContent = terms.length
      ? `Знайдено ${matches} із ${total} підказок`
      : `Підказок: ${total}. Шукайте за назвою предмета чи клавішею.`;
    empty.hidden = terms.length === 0 || matches !== 0;
  }

  input.addEventListener('input', update);
  clearButton.addEventListener('click', () => {
    input.value = '';
    update();
    input.focus();
  });
  for (const type of ['keydown', 'keyup', 'keypress']) {
    input.addEventListener(type, event => {
      // Keep typing (including game hotkeys) out of the global game handlers.
      event.stopPropagation();
      if (type === 'keydown' && event.key === 'Escape') {
        event.preventDefault();
        if (input.value) {
          input.value = '';
          update();
        } else {
          input.blur();
        }
      }
    });
  }
  window.addEventListener('resize', update);
  update();
})();
