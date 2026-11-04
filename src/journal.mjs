import { PRE_APPLY, APPLY } from './apply-hooks.mjs';
import { replayUndo, safeUpdate } from './helpers.mjs';

const MODULE_ID = 'draw-steel-ctlib';
const FLAG = 'journal';
export const JOURNAL_RECORDED = 'ctlib.journalRecorded';
export const JOURNAL_UNDONE = 'ctlib.journalUndone';

const flatten = (prefix, obj) => Object.entries(foundry.utils.flattenObject(obj)).reduce((out, [k, v]) => {
  out[`${prefix}.${k}`] = v;
  return out;
}, {});

function damageRecord(context) {
  const undo = [], targets = [];
  for (const a of context.applied ?? []) {
    if (a.group) {
      undo.push({ op: 'update', uuid: a.group.uuid, data: { 'system.staminaValue': a.before.value } });
      targets.push({ uuid: a.group.uuid, name: a.group.name, before: a.before.value, after: a.after.value });
      continue;
    }
    if (!a.actor) continue;
    undo.push({ op: 'update', uuid: a.actor.uuid, data: { 'system.stamina.value': a.before.value, 'system.stamina.temporary': a.before.temporary } });
    targets.push({ uuid: a.actor.uuid, name: a.actor.name, before: a.before.value, after: a.after.value,
      tempBefore: a.before.temporary, tempAfter: a.after.temporary });
  }
  return { undo, targets, amount: context.roll?.total ?? null, type: context.roll?.type ?? null, half: !!context.halfDamage };
}

function effectRecord(context) {
  const undo = [], targets = [];
  for (const [actor, before] of context._ctlibEffects ?? []) {
    const created = actor.effects.filter((e) => !before.has(e.id));
    for (const e of created) undo.push({ op: 'delete', uuid: e.uuid });
    if (created.length) targets.push({ uuid: actor.uuid, name: actor.name, effects: created.map((e) => e.name) });
  }
  return { undo, targets, effect: context.effectId ?? context.effect?.name ?? null };
}

function gainRecord(context) {
  const undo = [], targets = [];
  for (const [actor, before] of context._ctlibSystem ?? []) {
    const revert = foundry.utils.diffObject(actor.toObject().system, before);
    if (foundry.utils.isEmpty(revert)) continue;
    undo.push({ op: 'update', uuid: actor.uuid, data: flatten('system', revert) });
    targets.push({ uuid: actor.uuid, name: actor.name });
  }
  return { undo, targets };
}

async function record(part, action, details) {
  const message = part?.message;
  if (!message || !details.undo.length) return null;
  const entry = {
    id: foundry.utils.randomID(), at: Date.now(), userId: game.user.id, partId: part.id, action,
    ability: part.ability?.name ?? null, undone: false, ...details,
  };
  await safeUpdate(message, { [`flags.${MODULE_ID}.${FLAG}.${entry.id}`]: entry });
  Hooks.callAll(JOURNAL_RECORDED, message, entry);
  return entry;
}

export function journal(message) {
  return Object.values(message?.flags?.[MODULE_ID]?.[FLAG] ?? {}).sort((a, b) => a.at - b.at);
}

export async function undoJournalEntry(message, entryId) {
  const entry = message?.flags?.[MODULE_ID]?.[FLAG]?.[entryId];
  if (!entry || entry.undone) return false;
  if (!game.user.isGM && entry.userId !== game.user.id) return false;
  await replayUndo(entry.undo);
  await safeUpdate(message, { [`flags.${MODULE_ID}.${FLAG}.${entryId}.undone`]: true });
  Hooks.callAll(JOURNAL_UNDONE, message, { ...entry, undone: true });
  return true;
}

export function registerJournal() {
  Hooks.on(PRE_APPLY, (part, action, context) => {
    if (!context || context.relay) return;
    const targets = context.targets ?? [];
    if (action === 'applyEffect') context._ctlibEffects = targets.map((a) => [a, new Set(a.effects.map((e) => e.id))]);
    else if (action === 'gainResource') context._ctlibSystem = targets.map((a) => [a, a.toObject().system]);
  });
  Hooks.on(APPLY, (part, action, context) => {
    const details = action === 'applyDamage' ? { ...damageRecord(context), index: Array.from(part?.rolls ?? []).indexOf(context.roll) }
      : action === 'applyEffect' ? effectRecord(context)
        : action === 'gainResource' ? gainRecord(context) : null;
    if (details) record(part, action, details).catch((err) => console.error('CTLib | journal could not record an apply', err));
  });
}
