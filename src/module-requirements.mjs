

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function settingRequirement(def) {
  const req = def?.requiresModule;
  if (!req) return null;
  const id = typeof req === 'string' ? req : req.id;
  if (!id) return null;
  const label = (typeof req === 'object' && req.label) || game.modules.get(id)?.title || id;
  return { id, label };
}

export function moduleState(id) {
  const mod = game.modules.get(id);
  if (mod?.active) return 'active';
  return mod ? 'installed' : 'missing';
}

export const requirementMet = (def) => {
  const req = settingRequirement(def);
  return !req || moduleState(req.id) === 'active';
};

export function requiredSetting(namespace, key) {
  const def = game.settings.settings.get(`${namespace}.${key}`);
  if (!def) return undefined;
  return requirementMet(def) ? game.settings.get(namespace, key) : false;
}

const ICONS = { active: 'fa-check', installed: 'fa-plug-circle-exclamation', missing: 'fa-xmark' };

export function requirementBadgeHTML(def) {
  const req = settingRequirement(def);
  if (!req) return '';
  const state = moduleState(req.id);
  const tip = game.i18n.format(`CTLIB.settings.requires.${state}`, { module: req.label });
  return `<span class="ctlib-req-badge ctlib-req-${state}" data-tooltip="${esc(tip)}">`
    + `<i class="fas ${ICONS[state]}" inert></i> ${esc(req.label)}</span>`;
}

export function markRequirement(group, label, def) {
  if (!group || group.querySelector('.ctlib-req-badge')) return;
  const html = requirementBadgeHTML(def);
  if (!html) return;
  (label ?? group.querySelector('label'))?.insertAdjacentHTML('beforeend', html);
  if (requirementMet(def)) return;
  group.classList.add('ctlib-req-unmet');
  group.querySelectorAll('input, select, button, multi-select').forEach((i) => { i.disabled = true; });
}

Hooks.on('renderSettingsConfig', (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  if (!root) return;
  for (const [key, def] of game.settings.settings) {
    if (!def.requiresModule || !def.config) continue;
    const input = root.querySelector(`[name="${CSS.escape(key)}"]`);
    markRequirement(input?.closest('.form-group'), null, def);
  }
});
