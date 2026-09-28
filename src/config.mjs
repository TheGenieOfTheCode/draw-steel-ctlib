const _defaults = new Map();
const _providers = new Map();
const _warned = new Set();

const warnOnce = (key, message, error) => {
  if (_warned.has(key)) return;
  _warned.add(key);
  console.warn(`CTLib | config | ${message}`, error ?? '');
};

export const define = (key, fallback) => {
  if (!_defaults.has(key)) _defaults.set(key, fallback);
};

export const provide = (key, read) => {
  _providers.set(key, read);
};

export const get = (key) => {
  const read = _providers.get(key);
  if (read) {
    try { return read(); }
    catch (error) { warnOnce(key, `provider for "${key}" threw, using the default`, error); }
  }
  if (!_defaults.has(key)) {
    warnOnce(key, `"${key}" was read but never defined`);
    return undefined;
  }
  const fallback = _defaults.get(key);
  return (fallback && typeof fallback === 'object') ? foundry.utils.deepClone(fallback) : fallback;
};

export const describe = () => Object.fromEntries(
  [..._defaults.keys()].map((key) => [key, _providers.has(key) ? 'provided' : 'default'])
);
