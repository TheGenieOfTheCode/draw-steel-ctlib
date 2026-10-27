const LAYOUTS = new Map();

export function registerSettingsLayout(moduleId, groups) {
  LAYOUTS.set(moduleId, groups);
}

function applyLayout(root, moduleId, groups) {
  const section = root.querySelector(`section[data-category="${CSS.escape(moduleId)}"]`)
    ?? [...root.querySelectorAll(`[data-tab="${CSS.escape(moduleId)}"]`)].find((e) => e.tagName !== 'BUTTON');
  if (!section || section.querySelector(':scope > .ctlib-tab-group')) return;
  const rows = new Map();
  for (const group of section.querySelectorAll(':scope > .form-group')) {
    const key = group.querySelector('button[data-key]')?.dataset.key ?? group.querySelector('[name]')?.getAttribute('name');
    if (key) rows.set(key.replace(`${moduleId}.`, ''), group);
  }
  const placed = new Set();
  const built = [];
  for (const { label, items } of groups) {
    const members = items.map((key) => rows.get(key)).filter(Boolean);
    if (!members.length) continue;
    const wrap = document.createElement('div');
    wrap.className = 'ctlib-tab-group';
    const head = document.createElement('h3');
    head.className = 'ctlib-tab-header';
    head.textContent = game.i18n.localize(label);
    wrap.append(head, ...members);
    for (const m of members) placed.add(m);
    built.push(wrap);
  }
  if (!built.length) return;
  const rest = [...section.querySelectorAll(':scope > .form-group')].filter((g) => !placed.has(g));
  const anchor = section.querySelector(':scope > .form-group');
  if (anchor) anchor.before(...built, ...rest);
  else section.append(...built, ...rest);
}

Hooks.on('renderSettingsConfig', (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const [moduleId, groups] of LAYOUTS) applyLayout(root, moduleId, groups);
});
