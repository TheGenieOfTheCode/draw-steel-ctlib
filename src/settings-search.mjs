import { settingsSubmenu, innerSettings, searchHitChips, searchHitNav } from './settings-submenu.mjs';

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
    const hits = searchHitNav();
    group.append(inside, hits);
    rows.push({ settings, hits });
  }
  if (!rows.length) return;

  const input = root.querySelector('input[type=search]');
  const update = () => {
    const query = clean(input?.value);
    const rgx = new RegExp(RegExp.escape(query), 'i');
    for (const { settings, hits } of rows) searchHitChips(hits, query ? settings.filter((s) => rgx.test(clean(s.name))) : []);
  };
  input?.addEventListener('input', update);
  update();
});
