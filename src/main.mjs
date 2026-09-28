import * as ctlib from './index.mjs';
import { reviveDropKeys } from './helpers.mjs';
import { setSocket } from './socket.mjs';
import { registerStatusPalette } from './status-palette.mjs';

export const MODULE_ID = 'draw-steel-ctlib';

Hooks.once('socketlib.ready', () => {
  const socket = socketlib.registerModule(MODULE_ID);
  socket.register('ctlib.updateDocument',     async (uuid, data, options = {}) => { const doc = await fromUuid(uuid); if (doc) return await doc.update(reviveDropKeys(data), options); });
  socket.register('ctlib.deleteDocument',     async (uuid, options = {}) => { const doc = await fromUuid(uuid); if (doc) return await doc.delete(options); });
  socket.register('ctlib.createEmbedded',     async (parentUuid, type, data) => { const parent = await fromUuid(parentUuid); if (parent) return await parent.createEmbeddedDocuments(type, data); });
  socket.register('ctlib.toggleStatusEffect', async (uuid, effectId, options) => { const actor = await fromUuid(uuid); if (actor) return await actor.toggleStatusEffect(effectId, options); });
  setSocket(socket);
});

Hooks.once('init', () => {
  game.modules.get(MODULE_ID).api = ctlib;
  registerStatusPalette();
});
