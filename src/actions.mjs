import { isPrimaryGM, executeAsDirector } from './primary-director.mjs';
import { getSocket } from './socket.mjs';
import { setTip } from './rich-tips.mjs';

const ID = 'draw-steel-ctlib';
const FLAG = 'actions';
const KINDS = ['main', 'maneuver', 'move', 'triggered'];
const TRACKERS = ['draw-steel-combat-tools', 'draw-steel-triggers'];
const ICONS = {
  main: 'fa-burst',
  maneuver: 'fa-hand',
  move: 'fa-person-running',
  triggered: 'fa-bolt',
};
const MALICE_ICON = 'icons/magic/unholy/silhouette-robe-evil-power.webp';

const users = new Set();
const queues = new Map();

export const enable = (moduleId) => {
  const was = users.size;
  users.add(moduleId);
  if (!was) ui.combat?.render?.();
};
export const enabled = () => users.size > 0;

const FRESH = Object.freeze({ main: null, maneuver: false, move: false, triggered: false, apart: false, by: {} });
const SQUAD_MANEUVERS = new Set(['grab', 'knockback', 'hide', 'dsct-hide', 'search', 'dsct-search', 'search-for-hidden-creatures']);
const isMinion = (combatant) => !!combatant?.actor?.system?.isMinion;

export function combatantOf(target) {
  if (!target) return null;
  if (target.documentName === 'Combatant') return target;
  const doc = target.document ?? target;
  if (doc.documentName === 'Token') return doc.combatant ?? game.combats.find((c) => c.started)?.combatants.find((x) => x.tokenId === doc.id && x.sceneId === doc.parent?.id) ?? game.combats.map((c) => c.combatants.find((x) => x.tokenId === doc.id && x.sceneId === doc.parent?.id)).find(Boolean) ?? null;
  const actor = doc.documentName === 'Actor' ? doc : doc.actor;
  if (!actor) return null;
  const find = (c) => c?.combatants.find((x) => x.actor === actor || (!actor.isToken && x.actorId === actor.id)) ?? null;
  return find(game.combat) ?? game.combats.map(find).find(Boolean) ?? null;
}

export function isActing(combatant) {
  const combat = combatant?.parent;
  const current = combat?.started ? combat.combatant : null;
  if (!current) return false;
  return current.id === combatant.id || (!!combatant.group && combatant.group === current.group);
}

const trackerEffect = (actor) => {
  for (const scope of TRACKERS) {
    if (!game.modules.get(scope)?.active) continue;
    const e = actor?.effects.find((x) => x.getFlag(scope, 'effectType') === 'triggered-action');
    if (e) return e;
  }
  return null;
};

const live = (by) => Object.fromEntries(Object.entries(by ?? {}).filter(([, v]) => v != null));

export function get(target) {
  const combatant = combatantOf(target);
  if (!combatant) return null;
  const combat = combatant.parent;
  const stored = combatant.getFlag(ID, FLAG);
  const state = stored && stored.round === combat?.round ? { ...FRESH, ...stored, by: live(stored.by) } : { ...FRESH, by: {} };
  const effect = trackerEffect(combatant.actor);
  if (effect) state.triggered = !!effect.disabled;
  state.mainFree = state.main === null;
  state.minion = isMinion(combatant);
  state.onTurn = isActing(combatant);
  return state;
}

async function write(combatantUuid, patch) {
  const combatant = await fromUuid(combatantUuid).catch(() => null);
  if (!combatant) return null;
  const run = async () => {
    const combat = combatant.parent;
    const stored = combatant.getFlag(ID, FLAG);
    const base = stored && stored.round === combat?.round ? stored : { ...FRESH };
    const next = { ...base, ...patch, by: { ...(base.by ?? {}), ...(patch.by ?? {}) }, round: combat?.round ?? 0 };
    await combatant.setFlag(ID, FLAG, next);
    if ('triggered' in patch) {
      const effect = trackerEffect(combatant.actor);
      if (effect && effect.disabled !== !!patch.triggered) await effect.update({ disabled: !!patch.triggered }).catch(() => {});
    }
    return next;
  };
  const prior = queues.get(combatantUuid) ?? Promise.resolve();
  const next = prior.then(run, run);
  queues.set(combatantUuid, next.catch(() => {}));
  return next;
}

export async function set(target, patch) {
  const combatant = combatantOf(target);
  if (!combatant) return null;
  if (isPrimaryGM()) return write(combatant.uuid, patch);
  return executeAsDirector(getSocket(), 'ctlib.actions.write', combatant.uuid, patch);
}

export function plan(state, kind) {
  if (!state) return null;
  if (state.minion && kind !== 'triggered') {
    if (kind === 'move' && !state.move) return { move: true };
    if (state.main !== null || state.maneuver) return null;
    if (kind === 'maneuver') return { maneuver: true, main: 'maneuver' };
    return { main: kind };
  }
  if (kind === 'main') return state.main === null ? { main: 'main' } : null;
  if (kind === 'triggered') return state.triggered ? null : { triggered: true };
  if (!state[kind]) return { [kind]: true };
  return state.main === null ? { main: kind } : null;
}

const sources = (patch, source) => Object.fromEntries(Object.keys(patch).filter((k) => KINDS.includes(k)).map((k) => [k, source]));

export async function spend(target, kind, { source = null, force = false } = {}) {
  const state = get(target);
  if (!state || !KINDS.includes(kind)) return null;
  let patch = plan(state, kind);
  if (!patch && !force) return null;
  patch ??= kind === 'triggered' ? { triggered: true } : { [kind]: true };
  const slot = Object.keys(patch)[0];
  await set(target, { ...patch, by: source ? sources(patch, source) : {} });
  return slot;
}

export async function refund(target, { source = null, slot = null } = {}) {
  const state = get(target);
  if (!state) return [];
  const slots = slot ? [slot] : Object.entries(state.by).filter(([, s]) => s === source).map(([k]) => k);
  if (!slots.length) return [];
  const patch = { by: {} };
  for (const s of slots) {
    patch[s] = s === 'main' ? null : false;
    patch.by[s] = null;
  }
  if (slots.includes('maneuver')) patch.apart = false;
  await set(target, patch);
  return slots;
}

async function resetTurn(combatant) {
  const stored = combatant.getFlag(ID, FLAG);
  const by = Object.fromEntries(Object.entries(stored?.by ?? {}).filter(([k]) => k === 'triggered'));
  await write(combatant.uuid, { main: null, maneuver: false, move: false, apart: false, by: { main: null, maneuver: null, move: null, ...by } });
}

const isMalice = (item) => {
  const flag = item.flags?.['draw-steel-triggers']?.malice;
  if (flag !== undefined) return !!flag;
  return item.system?.category === 'maliceAncestry' || item.img === MALICE_ICON;
};

async function onAbilityUse(message) {
  if (message.flags?.[ID]?.granted) return;
  const use = message.system?.parts?.contents?.find((p) => p.type === 'abilityUse');
  if (!use?.abilityUuid) return;
  const item = await fromUuid(use.abilityUuid).catch(() => null);
  const type = item?.system?.type;
  if (!['main', 'maneuver', 'move', 'triggered'].includes(type) || isMalice(item)) return;
  const actor = ChatMessage.getSpeakerActor(message.speaker);
  const state = get(actor);
  if (!state) return;
  if (type !== 'triggered' && !state.onTurn) return;
  const combatant = combatantOf(actor);
  const squad = isMinion(combatant) && combatant.group ? combatant.group : null;
  if (squad && !state.apart && (type === 'main' || (type === 'maneuver' && SQUAD_MANEUVERS.has(item.system._dsid)))) {
    for (const member of squad.members) {
      if (!isMinion(member) || member.isDefeated) continue;
      const s = get(member);
      if (!s || s.apart) continue;
      const patch = plan(s, type);
      if (patch) await write(member.uuid, { ...patch, by: sources(patch, message.id) });
    }
    return;
  }
  const patch = plan(state, type);
  if (!patch) return;
  if (squad && type === 'maneuver') patch.apart = true;
  await write(combatant.uuid, { ...patch, by: sources(patch, message.id) });
}

async function onMessageDeleted(message) {
  for (const combat of game.combats) {
    if (!combat.started) continue;
    for (const combatant of combat.combatants) {
      const by = live(combatant.getFlag(ID, FLAG)?.by);
      if (by && Object.values(by).includes(message.id)) await refund(combatant, { source: message.id });
    }
  }
}

function pips(combatant) {
  const state = get(combatant);
  const box = document.createElement('span');
  box.className = 'ctlib-actions';
  const canEdit = combatant.isOwner;
  for (const kind of KINDS) {
    const used = kind === 'main' ? state.main !== null : state[kind];
    const as = kind === 'main' && state.main && state.main !== 'main' ? state.main : null;
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = `inline-control combatant-control icon fa-solid ${ICONS[as ?? kind]} ctlib-action ctlib-action-${kind}${used ? ' spent' : ''}${as ? ' converted' : ''}`;
    const label = game.i18n.localize(`CTLIB.actions.${kind}`);
    const status = game.i18n.localize(as ? `CTLIB.actions.as.${as}` : used ? 'CTLIB.actions.spent' : 'CTLIB.actions.free');
    setTip(btn, { title: label, category: game.i18n.localize('CTLIB.actions.category'), body: `${status[0].toUpperCase()}${status.slice(1)}.` });
    btn.setAttribute('aria-label', `${label}: ${status}`);
    if (!canEdit) btn.setAttribute('aria-disabled', 'true');
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (!canEdit) return;
      set(combatant, kind === 'main' ? { main: used ? null : 'main', by: { main: null } } : { [kind]: !used, by: { [kind]: null } });
    });
    box.append(btn);
  }
  return box;
}

function decorate(app, html) {
  if (!enabled()) return;
  const combat = app.viewed ?? game.combat;
  if (!combat?.started) return;
  const root = html instanceof HTMLElement ? html : html?.[0];
  for (const row of root?.querySelectorAll('li.combatant[data-combatant-id]') ?? []) {
    const combatant = combat.combatants.get(row.dataset.combatantId);
    if (!combatant?.actor || combatant.isDefeated) continue;
    if (!combatant.isOwner && combatant.hidden) continue;
    row.querySelector('.ctlib-actions')?.remove();
    const controls = row.querySelector('.combatant-controls');
    if (!controls) continue;
    controls.insertBefore(pips(combatant), controls.querySelector('.token-effects'));
  }
}

export function registerActions() {
  Hooks.on('renderCombatTracker', decorate);
  Hooks.on('updateActiveEffect', (effect) => {
    if (enabled() && TRACKERS.some((s) => effect.getFlag?.(s, 'effectType') === 'triggered-action')) ui.combat?.render?.();
  });
  Hooks.on('combatTurnChange', (combat, prior, current) => {
    if (!enabled() || !isPrimaryGM() || !current?.combatantId) return;
    if (prior?.combatantId === current.combatantId && prior?.round === current.round) return;
    const combatant = combat.combatants.get(current.combatantId);
    if (!combatant) return;
    const before = combat.combatants.get(prior?.combatantId);
    if (combatant.group && before?.group === combatant.group && prior?.round === current.round) return;
    const members = combatant.group ? Array.from(combatant.group.members ?? [combatant]) : [combatant];
    for (const m of members) resetTurn(m).catch((err) => console.warn(`${ID} | could not reset actions`, err));
  });
  Hooks.on('createChatMessage', (message) => {
    if (enabled() && isPrimaryGM()) onAbilityUse(message).catch((err) => console.warn(`${ID} | could not mark an action`, err));
  });
  Hooks.on('deleteChatMessage', (message) => {
    if (enabled() && isPrimaryGM()) onMessageDeleted(message).catch(() => {});
  });
}

export const writeHandler = (uuid, patch) => write(uuid, patch);
