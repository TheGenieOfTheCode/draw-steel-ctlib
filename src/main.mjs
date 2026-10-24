import * as ctlib from './api.mjs';
import { reviveDropKeys, initPalette } from './helpers.mjs';
import { setSocket } from './socket.mjs';
import './notices.mjs';
import { registerStatusPalette } from './status-palette.mjs';
import { registerMigration } from './migrate.mjs';
import { registerPrimaryDirector } from './primary-director.mjs';
import { registerCgmpGuard } from './cgmp.mjs';
import { registerRichTips } from './rich-tips.mjs';

export const MODULE_ID = 'draw-steel-ctlib';

globalThis.ctlib = ctlib;

Hooks.once('socketlib.ready', () => {
  const socket = socketlib.registerModule(MODULE_ID);
  socket.register('ctlib.updateDocument',     async (uuid, data, options = {}) => { const doc = await fromUuid(uuid); if (doc) return await doc.update(reviveDropKeys(data), options); });
  socket.register('ctlib.deleteDocument',     async (uuid, options = {}) => { const doc = await fromUuid(uuid); if (doc) return await doc.delete(options); });
  socket.register('ctlib.createEmbedded',     async (parentUuid, type, data) => { const parent = await fromUuid(parentUuid); if (parent) return await parent.createEmbeddedDocuments(type, data); });
  socket.register('ctlib.toggleStatusEffect', async (uuid, effectId, options) => { const actor = await fromUuid(uuid); if (actor) return await actor.toggleStatusEffect(effectId, options); });
  socket.register('ctlib.addTags',            async (uuid, tags) => { const doc = await fromUuid(uuid); if (doc && game.modules.get('tagger')?.active) await Tagger.addTags(doc, tags); });
  socket.register('ctlib.removeTags',         async (uuid, tags) => { const doc = await fromUuid(uuid); if (doc && game.modules.get('tagger')?.active) await Tagger.removeTags(doc, tags); });
  setSocket(socket);
});

Hooks.once('init', () => {
  game.modules.get(MODULE_ID).api = ctlib;
  registerPrimaryDirector();
  registerStatusPalette();
  registerMigration();
  registerCgmpGuard();
  registerRichTips();
  initPalette();
  new MutationObserver(initPalette).observe(document.body, { attributeFilter: ['class'] });
});

Hooks.on('canvasReady', () => { document.body.classList.toggle('ctlib-reduced-effects', ctlib.reducedEffects()); });
