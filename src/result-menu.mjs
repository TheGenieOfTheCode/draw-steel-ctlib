export const RESULT_MENU = 'ctlib.getResultPartContextOptions';

export function registerResultMenu() {
  Hooks.once('setup', () => {
    for (const type of ['abilityResult', 'targetResult']) {
      const proto = globalThis.ds?.CONFIG?.MessagePart?.[type]?.documentClass?.prototype;
      const original = proto?._getResultPartContextOptions;
      if (typeof original !== 'function' || Object.hasOwn(proto, '_ctlibResultMenu')) continue;
      proto._ctlibResultMenu = true;
      proto._getResultPartContextOptions = function (...args) {
        const options = original.apply(this, args);
        Hooks.callAll(RESULT_MENU, this, options);
        return options;
      };
    }
  });
}
