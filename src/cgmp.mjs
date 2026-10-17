

const CGMP = 'CautiousGamemastersPack';
const OURS = ['draw-steel-ctlib', 'draw-steel-combat-tools', 'draw-steel-triggers', 'draw-steel-battle-log', 'draw-steel-death-tracker'];

const isCard = (message) => (message.type && message.type !== 'base') || OURS.some((id) => message.flags?.[id]);

export function registerCgmpGuard() {
  const before = new WeakMap();
  
  Hooks.on('preCreateChatMessage', (message) => {
    if (!game.modules.get(CGMP)?.active || !isCard(message)) return;
    before.set(message, { speaker: foundry.utils.deepClone(message._source.speaker), style: message._source.style });
  });
  Hooks.once('ready', () => {
    if (!game.modules.get(CGMP)?.active) return;
    Hooks.on('preCreateChatMessage', (message) => {
      const was = before.get(message);
      if (!was) return;
      before.delete(message);
      const now = message._source;
      if (now.style !== was.style || !foundry.utils.objectsEqual(now.speaker, was.speaker)) message.updateSource(was);
    });
  });
}
