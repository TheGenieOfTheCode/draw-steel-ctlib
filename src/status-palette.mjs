const CORE = new Set(['dead', 'sleep', 'fly', 'burrow', 'blind', 'deaf', 'invisible']);

const _groups = new Map([
  ['system', { label: 'CTLIB.statusGroup.system', order: 10 }],
  ['module', { label: 'CTLIB.statusGroup.module', order: 80 }],
  ['core',   { label: 'CTLIB.statusGroup.core',   order: 90 }],
]);
const _claims = new Map();
const _matchers = [];

export const registerStatusGroup = ({ key, label, order = 50, statuses = [], match = null }) => {
  _groups.set(key, { label, order });
  for (const id of statuses) _claims.set(id, key);
  if (match) _matchers.push({ key, match });
};

const _systemIds = () => new Set([
  ...Object.keys(ds?.CONFIG?.conditions ?? {}),
  ...Object.keys(ds?.CONST?.staminaEffects ?? {}),
]);

const _groupOf = (id, systemIds) => {
  if (_claims.has(id)) return _claims.get(id);
  if (systemIds.has(id)) return 'system';
  if (CORE.has(id)) return 'core';
  const claimed = _matchers.find(({ match }) => match(id));
  if (claimed) return claimed.key;
  return 'module';
};

function _groupPalette(hud, html) {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const pane = root?.querySelector('section.effect-pane');
  if (!pane || pane.dataset.dsctGrouped) return;

  const entries = [...pane.querySelectorAll('div.effect-group')];
  if (!entries.length) return;
  pane.dataset.dsctGrouped = '1';

  const systemIds = _systemIds();
  const buckets = new Map();
  for (const entry of entries) {
    const key = _groupOf(entry.dataset.statusId ?? '', systemIds);
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(entry);
  }

  pane.replaceChildren();
  const keys = [...buckets.keys()].sort((a, b) => (_groups.get(a)?.order ?? 50) - (_groups.get(b)?.order ?? 50));
  for (const key of keys) {
    const header = document.createElement('h4');
    header.className = 'dsct-status-header';
    header.textContent = game.i18n.localize(_groups.get(key)?.label ?? key);
    pane.append(header, ...buckets.get(key));
  }
}

export function registerStatusPalette() {
  Hooks.on('renderTokenHUD', _groupPalette);
}
