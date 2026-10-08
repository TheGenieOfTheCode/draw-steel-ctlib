const ID = 'draw-steel-ctlib';
const KEY = 'primaryDirector';
const TRIGGERS_KEY = 'draw-steel-triggers.primaryGamemaster';

export function primaryGM() {
  let id = '';
  try { id = game.settings.get(ID, KEY); } catch { }
  const chosen = id ? game.users.get(id) : null;
  if (chosen?.isGM && chosen.active) return chosen;
  return game.users.activeGM ?? null;
}

export const isPrimaryGM = () => !!primaryGM()?.isSelf;

export const executeAsDirector = (socket, handler, ...args) => {
  if (!socket) return Promise.resolve(undefined);
  const gm = primaryGM();
  return gm && !gm.isSelf ? socket.executeAsUser(handler, gm.id, ...args) : socket.executeAsGM(handler, ...args);
};

const gmChoices = () => Object.fromEntries(game.users.filter((u) => u.isGM).map((u) => [u.id, u.name]));

function triggersChoice() {
  const stored = game.settings.storage.get('world')?.getSetting(TRIGGERS_KEY)?.value;
  if (!stored) return null;
  let id = stored;
  try { id = JSON.parse(stored); } catch { }
  return typeof id === 'string' && game.users.get(id)?.isGM ? id : null;
}

async function claimPrimaryGM() {
  if (!game.user.isGM || !game.users.activeGM?.isSelf) return;
  const held = game.settings.get(ID, KEY);
  if (held && game.users.get(held)?.isGM) return;
  await game.settings.set(ID, KEY, triggersChoice() ?? game.user.id);
}

export function registerPrimaryDirector() {
  game.settings.register(ID, KEY, {
    name: 'CTLIB.settings.primaryDirector.name',
    hint: 'CTLIB.settings.primaryDirector.hint',
    scope: 'world', config: true, type: String, default: '', choices: {},
  });
  Hooks.once('ready', () => {
    const cfg = game.settings.settings.get(`${ID}.${KEY}`);
    if (cfg) cfg.choices = gmChoices();
    claimPrimaryGM().catch((err) => console.warn(`${ID} | could not claim the Primary Director seat`, err));
  });
}
