
export const DAMAGE_TYPES = Object.freeze({
  acid:       { icon: 'fa-solid fa-flask-vial',          dark: '#6fbf4a', light: '#3d7a22' },
  cold:       { icon: 'fa-solid fa-snowflake',           dark: '#65c7f7', light: '#1f72a8' },
  corruption: { icon: 'fa-brands fa-galactic-republic',  dark: '#9b59b6', light: '#7d3c98' },
  fire:       { icon: 'fa-solid fa-fire',                dark: '#e74c3c', light: '#c0392b' },
  holy:       { icon: 'fa-solid fa-sun',                 dark: '#f1c40f', light: '#8a6d00' },
  lightning:  { icon: 'fa-solid fa-bolt',                dark: '#f7dc6f', light: '#8c7300' },
  poison:     { icon: 'fa-solid fa-skull-crossbones',    dark: '#2ecc71', light: '#1e7a44' },
  psychic:    { icon: 'fa-solid fa-brain',               dark: '#e056fd', light: '#9b27b8' },
  sonic:      { icon: 'fa-solid fa-volume-high',         dark: '#00cec9', light: '#00807b' },
  untyped:    { icon: 'fa-solid fa-burst',               dark: null,      light: null },
  healing:    { icon: 'fa-solid fa-heart-pulse',         dark: '#2ecc71', light: '#1e7a44' },
  temporary:  { icon: 'fa-solid fa-shield-halved',       dark: '#2ecc71', light: '#1e7a44' },
});

const OWN_LABELS = new Set(['untyped', 'healing', 'temporary']);

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));

export const damageTypeLabel = (type) => {
  const label = globalThis.ds?.CONFIG?.damageTypes?.[type]?.label;
  if (label) return game.i18n.localize(label);
  if (!type) type = 'untyped';
  if (OWN_LABELS.has(type)) return game.i18n.localize(`CTLIB.damage.${type}`);
  return String(type);
};

export const damageTypeIconHTML = (type, { className = '' } = {}) => {
  if (!type) type = 'untyped';
  const known = DAMAGE_TYPES[type];
  if (!known) return '';
  return `<i class="${known.icon} ctlib-dmg ctlib-dmg-${esc(type)} ${esc(className)}" data-tooltip="${esc(damageTypeLabel(type))}"></i>`;
};
