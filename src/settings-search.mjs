import { settingsSubmenu } from './settings-submenu.mjs';

const debugOn = (id) => game.settings.settings.has(`${id}.debugMode`) && game.settings.get(id, 'debugMode');

function innerSettings(type, seen = new Set()) {
  const id = type.moduleId;
  if (!id || seen.has(type)) return [];
  seen.add(type);
  const Submenu = settingsSubmenu();
  const keys = [...type.regularKeys, ...(debugOn(id) ? type.debugKeys : [])];
  return keys.flatMap((k) => {
    if (k?.opens?.prototype instanceof Submenu && !(k.gmOnly && !game.user.isGM)) return innerSettings(k.opens, seen);
    if (typeof k !== 'string') return [];
    const def = game.settings.settings.get(`${id}.${k}`);
    if (!def || (!game.user.isGM && def.scope === 'world')) return [];
    const name = game.i18n.localize(def.name);
    return name ? [{ key: k, name, type }] : [];
  });
}

const clean = (q) => foundry.applications.ux.SearchFilter.cleanQuery(q ?? '');

Hooks.on('renderSettingsConfig', (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  const Submenu = settingsSubmenu();
  const rows = [];
  for (const button of root.querySelectorAll('.form-group button[data-key]')) {
    const menu = game.settings.menus.get(button.dataset.key);
    if (!menu?.type || !(menu.type.prototype instanceof Submenu)) continue;
    const settings = innerSettings(menu.type);
    if (!settings.length) continue;
    const group = button.closest('.form-group');
    if (group.querySelector('.ctlib-search-inside')) continue;
    const inside = document.createElement('div');
    inside.className = 'ctlib-search-inside';
    inside.hidden = true;
    for (const s of settings) {
      const span = document.createElement('span');
      span.dataset.searchable = '';
      span.textContent = s.name;
      inside.append(span);
    }
    const hits = document.createElement('nav');
    hits.className = 'dsct-sub-chips ctlib-search-hits';
    hits.setAttribute('aria-label', game.i18n.localize('CTLIB.settings.searchInside'));
    hits.hidden = true;
    group.append(inside, hits);
    rows.push({ settings, hits });
  }
  if (!rows.length) return;

  const input = root.querySelector('input[type=search]');
  const update = () => {
    const query = clean(input?.value);
    const rgx = new RegExp(RegExp.escape(query), 'i');
    for (const { settings, hits } of rows) {
      const found = query ? settings.filter((s) => rgx.test(clean(s.name))) : [];
      hits.replaceChildren(...found.map((s) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = s.name;
        b.addEventListener('click', () => new s.type({ focusKey: s.key }).render(true));
        return b;
      }));
      hits.hidden = !found.length;
    }
  };
  input?.addEventListener('input', update);
  update();
});
