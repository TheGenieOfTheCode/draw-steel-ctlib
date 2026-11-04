const parts = (message) => Array.from(message?.system?.parts?.contents ?? message?.system?.parts ?? [])
  .map((p) => (Array.isArray(p) ? p[1] : p)).filter(Boolean);

const isPowerRoll = (roll) => roll instanceof ds.rolls.PowerRoll;

function actorUuidOf(target) {
  if (!target) return null;
  if (typeof target === 'string') {
    const doc = fromUuidSync(target, { strict: false });
    return doc?.documentName === 'Actor' ? doc.uuid : doc?.actor?.uuid ?? null;
  }
  if (target.documentName === 'Actor') return target.uuid;
  return target.actor?.uuid ?? null;
}

const validTier = (t) => (Number(t) >= 1 && Number(t) <= 3 ? Number(t) : null);

export function rolledTargets(message) {
  const out = new Map();
  for (const part of parts(message)) {
    if (part.type === 'targetResult' && part.targetUuid && !out.has(part.targetUuid)) {
      out.set(part.targetUuid, { actorUuid: part.targetUuid, tokenUuid: part.tokenUuid ?? null, tier: validTier(part.tier), part });
      continue;
    }
    if (part.type !== 'abilityResult') continue;
    for (const roll of Array.from(part.rolls ?? [])) {
      const uuid = roll?.options?.target;
      if (uuid && !out.has(uuid)) out.set(uuid, { actorUuid: uuid, tokenUuid: null, tier: validTier(part.tier), part });
    }
  }
  return [...out.values()];
}

export function tierFor(message, target) {
  if (target && typeof message?.system?.tierFor === 'function') {
    const actor = typeof target === 'string' ? fromUuidSync(target, { strict: false }) : target;
    return validTier(message.system.tierFor(actor));
  }
  const uuid = actorUuidOf(target);
  const results = parts(message).filter((p) => p.type === 'abilityResult');
  if (uuid) {
    const hit = results.find((p) => Array.from(p.rolls ?? []).some((r) => r?.options?.target === uuid));
    if (hit) return validTier(hit.tier);
  }
  const targeted = results.some((p) => Array.from(p.rolls ?? []).some((r) => r?.options?.target));
  return targeted ? null : validTier(results[0]?.tier);
}

export async function addTargetResult(message, token) {
  const doc = token?.document ?? token;
  const actor = doc?.actor;
  if (!message || !doc?.uuid || !actor) return null;
  const all = parts(message);
  if (all.some((p) => p.type === 'targetResult' && (p.tokenUuid === doc.uuid || p.targetUuid === actor.uuid))) return null;
  const template = all.find((p) => p.type === 'targetResult') ?? all.find((p) => p.type === 'abilityResult');
  if (!template) return null;
  const id = foundry.utils.randomID();
  await message.update({ [`system.parts.${id}`]: {
    _id: id,
    type: 'targetResult',
    rolls: Array.from(template.rolls ?? []).map((r) => JSON.stringify(r.toJSON())),
    tier: template.tier,
    abilityUuid: template.abilityUuid,
    targetUuid: actor.uuid,
    tokenUuid: doc.uuid,
  } });
  return parts(message).find((p) => p.id === id) ?? null;
}

export function powerRollFor(message, target) {
  const uuid = actorUuidOf(target);
  const all = parts(message);
  if (uuid) {
    const own = all.find((p) => p.type === 'targetResult' && p.targetUuid === uuid);
    if (own) return Array.from(own.rolls ?? []).find(isPowerRoll) ?? null;
    for (const part of all) {
      const roll = Array.from(part.rolls ?? []).reverse().find((r) => isPowerRoll(r) && r?.options?.target === uuid);
      if (roll) return roll;
    }
  }
  for (const part of all) {
    if (part.type === 'targetResult') continue;
    const roll = Array.from(part.rolls ?? []).reverse().find((r) => isPowerRoll(r) && !r?.options?.target);
    if (roll) return roll;
  }
  return null;
}
