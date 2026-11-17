import { wrapMethod } from './helpers.mjs';

const MODULE_ID = 'draw-steel-ctlib';
const STAMP = 'summonedBy';

let _summoning = null;

const tokenDocOf = (thing) => {
  if (thing?.documentName === 'Token') return thing;
  if (thing?.document?.documentName === 'Token') return thing.document;
  return thing?.token ?? null;
};
const actorOf = (thing) => (thing?.documentName === 'Actor' ? thing : thing?.actor ?? null);
const sameActor = (a, b) => !!a && !!b && (a === b || a.uuid === b.uuid || (a.id === b.id && !a.isToken && !b.isToken));
const ownerActor = (doc) => (doc?.documentName === 'Actor' ? doc : doc?.actor ?? null);

export function summonSourceOf(thing) {
  const stamped = tokenDocOf(thing)?.getFlag?.(MODULE_ID, STAMP);
  if (stamped) return stamped;
  return actorOf(thing)?.getFlag?.('draw-steel', 'summonSource') ?? null;
}

export const isSummoned = (thing) => !!summonSourceOf(thing);

export function summonerOf(thing) {
  const uuid = summonSourceOf(thing);
  return uuid ? ownerActor(fromUuidSync(uuid, { strict: false })) : null;
}

export function summonsOf(actor, { abilityUuid = null } = {}) {
  return (canvas?.tokens?.placeables ?? []).filter((t) => {
    const source = summonSourceOf(t);
    if (!source) return false;
    if (abilityUuid) return source === abilityUuid;
    return sameActor(ownerActor(fromUuidSync(source, { strict: false })), actor);
  });
}

export const masterOf = (actor) => actor?.system?.companion?.master ?? null;

export function companionsOf(hero) {
  if (!hero) return [];
  return (canvas?.tokens?.placeables ?? []).filter((t) => t.actor?.type === 'companion' && sameActor(masterOf(t.actor), hero));
}

async function stampSummons(wrapped, ...args) {
  _summoning = this.parent?.uuid ?? null;
  try { return await wrapped(...args); }
  finally { _summoning = null; }
}

export function registerSummons() {
  Hooks.once('ready', () => {
    if (typeof CONFIG.Item.dataModels?.ability?.prototype?.performSummon !== 'function') return;
    wrapMethod('CONFIG.Item.dataModels.ability.prototype.performSummon', stampSummons);
  });
  Hooks.on('preCreateToken', (doc) => {
    if (_summoning) doc.updateSource({ [`flags.${MODULE_ID}.${STAMP}`]: _summoning });
  });
}
