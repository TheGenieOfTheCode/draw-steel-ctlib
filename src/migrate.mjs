import { CTLIB_SCOPE, LEGACY_SCOPE } from './helpers.mjs';

const MARKER = 'migratedFromCombatTools';

const COPIED_KEYS = ['tags', 'lowCover', 'cover', 'loe', 'coverImmunity'];
const OLD_KEY = `flags.${LEGACY_SCOPE}.`;
const NEW_KEY = `flags.${CTLIB_SCOPE}.`;
const MOVED_KEY = (key) => key.startsWith(`${OLD_KEY}loe.`) || key === `${OLD_KEY}cover`;

const copiedFlags = (doc) => {
  const old = doc?._source?.flags?.[LEGACY_SCOPE];
  if (!old) return null;
  const own = doc._source.flags?.[CTLIB_SCOPE] ?? {};
  const update = {};
  for (const key of COPIED_KEYS) {
    if (old[key] === undefined || own[key] !== undefined) continue;
    update[`${NEW_KEY}${key}`] = foundry.utils.deepClone(old[key]);
  }
  return Object.keys(update).length ? update : null;
};

const repointChanges = (changes) => {
  if (!Array.isArray(changes) || !changes.some((c) => MOVED_KEY(c?.key ?? ''))) return null;
  return changes.map((c) => (MOVED_KEY(c?.key ?? '') ? { ...c, key: NEW_KEY + c.key.slice(OLD_KEY.length) } : c));
};

const effectUpdate = (effect) => {
  const update = copiedFlags(effect) ?? {};
  const own = repointChanges(effect._source?.changes);
  if (own) update.changes = own;
  const system = repointChanges(effect._source?.system?.changes);
  if (system) update['system.changes'] = system;
  return Object.keys(update).length ? { _id: effect.id, ...update } : null;
};

const migrateEffects = async (parent) => {
  const updates = (parent?.effects?.contents ?? []).map(effectUpdate).filter(Boolean);
  if (updates.length) await parent.updateEmbeddedDocuments('ActiveEffect', updates);
  return updates.length;
};

const migrateActor = async (actor) => {
  let count = 0;
  const own = copiedFlags(actor);
  if (own) { await actor.update(own); count++; }
  count += await migrateEffects(actor);
  for (const item of actor.items ?? []) count += await migrateEffects(item);
  return count;
};

const migrateEmbedded = async (scene, name) => {
  const updates = (scene[name]?.contents ?? [])
    .map((doc) => { const u = copiedFlags(doc); return u ? { _id: doc.id, ...u } : null; })
    .filter(Boolean);
  if (updates.length) await scene.updateEmbeddedDocuments(scene[name].documentName, updates);
  return updates.length;
};

export const registerMigration = () => {
  game.settings.register(CTLIB_SCOPE, MARKER, { scope: 'world', config: false, type: Boolean, default: false });
  Hooks.once('ready', async () => {
    if (!game.users.activeGM?.isSelf) return;
    if (game.settings.get(CTLIB_SCOPE, MARKER)) return;
    let count = 0;
    const step = async (label, fn) => {
      try { count += await fn(); }
      catch (err) { console.warn(`CTLib | could not carry ${label} over from Combat Tools:`, err); }
    };
    for (const actor of game.actors) await step(`actor ${actor.name}`, () => migrateActor(actor));
    for (const item of game.items) await step(`item ${item.name}`, () => migrateEffects(item));
    for (const scene of game.scenes) {
      for (const name of ['walls', 'tiles', 'tokens']) await step(`${name} in ${scene.name}`, () => migrateEmbedded(scene, name));
      for (const token of scene.tokens) {
        if (token.actorLink || !token.actor) continue;
        await step(`token ${token.name} in ${scene.name}`, () => migrateActor(token.actor));
      }
    }
    await game.settings.set(CTLIB_SCOPE, MARKER, true);
    if (count) console.log(`CTLib | carried ${count} document(s) over from Combat Tools`);
  });
};
