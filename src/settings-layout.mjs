import { addWikiLink, wikiUrl } from './wiki-links.mjs';

const LAYOUTS = new Map();

export function registerSettingsLayout(moduleId, groups, options = {}) {
  LAYOUTS.set(moduleId, { groups, options });
}

function addChips(root, section, groups) {
  const nav = document.createElement('nav');
  nav.className = 'dsct-sub-chips ctlib-tab-chips';
  nav.setAttribute('aria-label', game.i18n.localize('CTLIB.settings.sections'));
  const chips = groups.map((group) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = group.querySelector('.ctlib-tab-header')?.textContent ?? '';
    nav.append(b);
    return { b, group };
  });
  section.prepend(nav);
  const pad = parseFloat(getComputedStyle(section).paddingTop) || 0;
  nav.style.top = `-${pad}px`;
  nav.style.paddingTop = `${pad + 2}px`;
  nav.style.marginTop = `-${pad}px`;

  let pinned = null;
  const visible = (g) => getComputedStyle(g).display !== 'none';
  const spy = () => {
    let on = pinned;
    if (!on) {
      const top = section.getBoundingClientRect().top + nav.offsetHeight + 8;
      for (const { group } of chips) if (visible(group) && group.getBoundingClientRect().top <= top) on = group;
      on ??= chips.find(({ group }) => visible(group))?.group;
    }
    for (const { b, group } of chips) {
      b.classList.toggle('dsct-sub-chip-on', group === on);
      b.classList.toggle('dsct-sub-chip-empty', !visible(group));
    }
  };
  for (const { b, group } of chips) {
    b.addEventListener('click', () => {
      pinned = group;
      const offset = group.getBoundingClientRect().top - section.getBoundingClientRect().top;
      section.scrollTo({ top: section.scrollTop + offset - nav.offsetHeight - 8, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      spy();
    });
  }
  const unpin = () => { if (pinned) { pinned = null; spy(); } };
  section.addEventListener('scroll', spy);
  for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) section.addEventListener(type, unpin, { passive: true });
  root.querySelector('input[type=search]')?.addEventListener('input', () => { pinned = null; setTimeout(spy, 300); });
  spy();
}

const keyOf = (group, moduleId) => {
  const key = group.querySelector('button[data-key]')?.dataset.key ?? group.querySelector('[name]')?.getAttribute('name');
  return key?.replace(`${moduleId}.`, '') ?? null;
};

function applyLayout(root, moduleId, { groups, options }) {
  const section = root.querySelector(`section[data-category="${CSS.escape(moduleId)}"]`)
    ?? [...root.querySelectorAll(`[data-tab="${CSS.escape(moduleId)}"]`)].find((e) => e.tagName !== 'BUTTON');
  if (!section || section.dataset.ctlibLayout) return;
  section.dataset.ctlibLayout = '1';
  const rows = new Map();
  for (const group of section.querySelectorAll(':scope > .form-group')) {
    const key = keyOf(group, moduleId);
    if (key) rows.set(key, group);
  }
  const wiki = options.wiki ?? {};
  const url = (page) => wikiUrl(wiki.base, page);

  const placed = new Set();
  const built = [];
  for (const { label, items, wiki: page } of groups) {
    const members = items.map((key) => rows.get(key)).filter(Boolean);
    if (!members.length) continue;
    const wrap = document.createElement('div');
    wrap.className = 'ctlib-tab-group';
    const head = document.createElement('h3');
    head.className = 'ctlib-tab-header';
    head.textContent = game.i18n.localize(label);
    addWikiLink(head, url(page));
    wrap.append(head, ...members);
    for (const m of members) placed.add(m);
    built.push(wrap);
  }
  if (built.length) {
    const rest = [...section.querySelectorAll(':scope > .form-group')].filter((g) => !placed.has(g));
    const anchor = section.querySelector(':scope > .form-group');
    if (anchor) anchor.before(...built, ...rest);
    else section.append(...built, ...rest);
    if (built.length >= 4) addChips(root, section, built);
  }

  for (const [key, page] of Object.entries(wiki.pages ?? {})) addWikiLink(rows.get(key)?.querySelector(':scope > label'), url(page));

  for (const key of options.indent ?? []) rows.get(key)?.classList.add('ctlib-tab-sub');
  const deps = options.dependencies ?? {};
  if (!Object.keys(deps).length) return;
  const inputOf = (key) => section.querySelector(`[name="${CSS.escape(`${moduleId}.${key}`)}"]`);
  const isOn = (key) => {
    const input = inputOf(key);
    if (input) return input.checked;
    return game.settings.settings.has(`${moduleId}.${key}`) ? !!game.settings.get(moduleId, key) : true;
  };
  const offOf = (key, seen = new Set()) => {
    const spec = deps[key];
    if (!spec || seen.has(key)) return false;
    seen.add(key);
    const parent = spec.replace(/^!/, '');
    return (spec.startsWith('!') ? isOn(parent) : !isOn(parent)) || offOf(parent, seen);
  };
  const sync = () => {
    for (const child of Object.keys(deps)) {
      const group = rows.get(child);
      if (!group) continue;
      const off = offOf(child);
      group.classList.toggle('ctlib-tab-off', off);
      group.querySelectorAll('input, select, button, file-picker').forEach((i) => { i.disabled = off; });
    }
  };
  for (const child of Object.keys(deps)) rows.get(child)?.classList.add('ctlib-tab-sub');
  for (const parent of new Set(Object.values(deps).map((v) => v.replace(/^!/, '')))) inputOf(parent)?.addEventListener('change', sync);
  sync();
  queueMicrotask(sync);
}

Hooks.on('renderSettingsConfig', (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const [moduleId, layout] of LAYOUTS) applyLayout(root, moduleId, layout);
});
