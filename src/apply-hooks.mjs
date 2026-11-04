import { getSocket } from './socket.mjs';
import { primaryGM, executeAsDirector } from './primary-director.mjs';

export const PRE_APPLY = 'ctlib.preApplyTargetResult';
export const APPLY = 'ctlib.applyTargetResult';

let _mode = 'none';
export const applyHooksMode = () => _mode;

const _squadDamage = new Set();

const stamina = (actor) => ({ value: actor.system.stamina.value, temporary: actor.system.stamina.temporary });

const squadOf = (actor) => (actor.isMinion && actor.system.combatGroup && actor.system.combatGroups.size <= 1 ? actor.system.combatGroup : null);

function trackSquadDamage() {
  const model = CONFIG.CombatantGroup?.dataModels?.squad;
  const takeDamage = model?.prototype?.takeDamage;
  if (!takeDamage) return;
  model.prototype.takeDamage = function (...args) {
    const run = takeDamage.apply(this, args);
    _squadDamage.add(run);
    run.finally(() => _squadDamage.delete(run)).catch(() => {});
    return run;
  };
}

async function applyDamage(part, { targets, roll, halfDamage }) {
  const actors = [];
  const squads = new Map();
  for (const actor of targets) {
    const group = squadOf(actor);
    if (!group) { actors.push({ actor, before: stamina(actor) }); continue; }
    if (!squads.has(group.uuid)) squads.set(group.uuid, { group, actors: [], before: { value: group.system.staminaValue } });
    squads.get(group.uuid).actors.push(actor);
  }
  await roll.applyDamage(targets, { halfDamage, origin: ds.rolls.DamageRoll.getOrigin?.(part.message, part) });
  await Promise.allSettled([..._squadDamage]);
  return [
    ...actors.map((a) => ({ ...a, after: stamina(a.actor) })),
    ...[...squads.values()].map((s) => ({ ...s, after: { value: s.group.system.staminaValue } })),
  ];
}

function wrapActions(actions) {
  const { applyEffect, gainResource } = actions;

  actions.applyDamage = async function (event, target) {
    const context = { targets: [this.actorTarget], roll: this.rolls[target.dataset.index], halfDamage: event.shiftKey };
    if (Hooks.call(PRE_APPLY, this, 'applyDamage', context) === false) return;
    context.applied = await applyDamage(this, context);
    Hooks.callAll(APPLY, this, 'applyDamage', context);
  };

  actions.applyEffect = async function (event, target) {
    const effect = await fromUuid(target.dataset.uuid);
    if (!effect) return applyEffect.call(this, event, target);
    const context = { targets: [this.actorTarget], effect, effectId: target.dataset.effectId };
    if (Hooks.call(PRE_APPLY, this, 'applyEffect', context) === false) return;
    await effect.applyEffect(this.tierKey, context.effectId, { targets: context.targets });
    Hooks.callAll(APPLY, this, 'applyEffect', context);
  };

  actions.gainResource = async function (event, target) {
    const effect = await fromUuid(target.dataset.uuid);
    if (!effect) return gainResource.call(this, event, target);
    const context = { targets: [this.actorTarget], effect };
    if (Hooks.call(PRE_APPLY, this, 'gainResource', context) === false) return;
    await effect.applyGain(this.tierKey, { targets: context.targets });
    Hooks.callAll(APPLY, this, 'gainResource', context);
  };
}

const OWNER_ACTIONS = ['applyDamage', 'applyEffect', 'gainResource'];
const OWNER_BUTTONS = OWNER_ACTIONS.map((a) => `[data-action="${a}"]`).join(', ');
const resultClass = () => globalThis.ds?.CONFIG?.MessagePart?.targetResult?.documentClass ?? null;

function relayAllowed(part) {
  if (game.user.isGM || part.actorTarget?.isOwner) return false;
  let on = true;
  try { on = game.settings.get('draw-steel-ctlib', 'playerApply'); } catch { }
  return on && (part.message?.isOwner || part.ability?.isOwner);
}

function addRelay(actions) {
  for (const name of OWNER_ACTIONS) {
    const inner = actions[name];
    if (typeof inner !== 'function') continue;
    actions[name] = async function (event, target) {
      if (!relayAllowed(this)) return inner.call(this, event, target);
      if (!primaryGM()) return void ui.notifications.warn(game.i18n.localize('CTLIB.apply.noDirector'));
      if (Hooks.call(PRE_APPLY, this, name, { targets: [this.actorTarget], relay: true }) === false) return;
      return executeAsDirector(getSocket(), 'ctlib.relayTargetResult', this.message.id, this.id, name, { shiftKey: !!event?.shiftKey, dataset: { ...(target?.dataset ?? {}) } });
    };
  }
}

export async function applyAllDamage(message, { halfDamage = false } = {}) {
  const action = resultClass()?.ACTIONS?.applyDamage;
  if (typeof action !== 'function') return 0;
  let applied = 0;
  for (const part of Array.from(message?.system?.parts?.contents ?? [])) {
    if (part.type !== 'targetResult') continue;
    const index = Array.from(part.rolls ?? []).findIndex((r) => r instanceof ds.rolls.DamageRoll && !r.isHeal);
    if (index < 0) continue;
    await action.call(part, { shiftKey: halfDamage }, { dataset: { index: String(index) } });
    applied++;
  }
  return applied;
}

export async function relayTargetResult(messageId, partId, name, data = {}) {
  const part = game.messages.get(messageId)?.system?.parts?.get(partId);
  const action = resultClass()?.ACTIONS?.[name];
  if (!part || !OWNER_ACTIONS.includes(name) || typeof action !== 'function') return false;
  await action.call(part, { shiftKey: !!data.shiftKey }, { dataset: { ...(data.dataset ?? {}) } });
  return true;
}

function unlockOwnerButtons() {
  const proto = resultClass()?.prototype;
  const original = proto?._addListeners;
  if (typeof original !== 'function') return;
  proto._addListeners = function (element, context) {
    original.call(this, element, context);
    if (!relayAllowed(this)) return;
    for (const button of element.querySelectorAll(OWNER_BUTTONS)) {
      button.disabled = false;
      button.classList.remove('disabled');
    }
  };
}

export function registerApplyHooks() {
  game.settings.register('draw-steel-ctlib', 'playerApply', {
    name: 'CTLIB.settings.playerApply.name',
    hint: 'CTLIB.settings.playerApply.hint',
    scope: 'world',
    config: true,
    type: Boolean,
    default: true,
  });
  Hooks.once('setup', () => {
    const actions = resultClass()?.ACTIONS;
    if (!actions?.applyDamage) return;
    if (String(actions.applyDamage).includes('ds.preApplyTargetResult')) {
      _mode = 'system';
      Hooks.on('ds.preApplyTargetResult', (part, action, context) => Hooks.call(PRE_APPLY, part, action, context));
      Hooks.on('ds.applyTargetResult', (part, action, context) => Hooks.callAll(APPLY, part, action, context));
    } else {
      _mode = 'wrapped';
      trackSquadDamage();
      wrapActions(actions);
    }
    addRelay(actions);
    unlockOwnerButtons();
  });
}
