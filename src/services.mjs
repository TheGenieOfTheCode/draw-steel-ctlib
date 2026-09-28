
const _services = new Map();

export const provide = (name, fn) => {
  if (typeof fn !== 'function') throw new TypeError(`CTLib | services | "${name}" must be a function`);
  _services.set(name, fn);
};

export const get = (name) => _services.get(name);
export const has = (name) => _services.has(name);
export const describe = () => [..._services.keys()].sort();
