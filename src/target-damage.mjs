import { journal, undoJournalEntry } from './journal.mjs';
import { resultClass, damageIndex } from './apply-hooks.mjs';
import * as services from './services.mjs';
import { safeUpdate } from './helpers.mjs';

const MODULE_ID = 'draw-steel-ctlib';

const latest = (message) => game.messages.get(message?.id) ?? message;

export function targetResultFor(message, key) {
  const uuid = String(key ?? '').replace(/__/g, '.');
  if (!uuid) return null;
  return Array.from(message?.system?.parts?.contents ?? [])
    .find((p) => p.type === 'targetResult' && (p.tokenUuid === uuid || p.targetUuid === uuid)) ?? null;
}

const liveDamage = (message, part) => journal(message).filter((e) => e.action === 'applyDamage' && !e.undone && e.partId === part.id);


const changedNothing = (entry) => (entry.targets ?? []).every((t) => t.before === t.after && (t.tempBefore ?? 0) === (t.tempAfter ?? 0));

export async function undoTargetDamage(message, key) {
  const part = targetResultFor(latest(message), key);
  if (!part) return false;
  let any = false;
  for (const entry of liveDamage(latest(message), part).reverse()) {
    if (changedNothing(entry)) {
      await safeUpdate(latest(message), { [`flags.${MODULE_ID}.journal.${entry.id}.undone`]: true });
      continue;
    }
    if (await undoJournalEntry(latest(message), entry.id)) any = true;
  }
  return any;
}

export async function applyTargetDamage(message, key, { halfDamage = false } = {}) {
  const part = targetResultFor(latest(message), key);
  const action = resultClass()?.ACTIONS?.applyDamage;
  const index = part ? damageIndex(part) : -1;
  if (!part || index < 0 || typeof action !== 'function' || liveDamage(latest(message), part).length) return false;
  await action.call(part, { shiftKey: halfDamage }, { dataset: { index: String(index) } });
  return true;
}

export function registerTargetDamageServices() {
  Hooks.once('setup', () => {
    if (game.modules.get('draw-steel-target-damage')?.active || typeof resultClass()?.ACTIONS?.applyDamage !== 'function') return;
    services.provide('undoDamageRow', undoTargetDamage);
    services.provide('reapplyDamageRow', async (message, key) => {
      await undoTargetDamage(message, key);
      return applyTargetDamage(message, key);
    });
    services.provide('redealDamageRow', async (message, key) => {
      const part = targetResultFor(latest(message), key);
      if (!part || !liveDamage(latest(message), part).length) return false;
      await undoTargetDamage(message, key);
      return applyTargetDamage(message, key);
    });
  });
}
