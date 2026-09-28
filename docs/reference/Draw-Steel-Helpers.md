# Draw Steel Helpers

Helpers that know how the Draw Steel system stores things: squads, Stamina, sizes, abilities and power rolls.

## Squads and Stamina

| Function | Returns |
|---|---|
| `getSquadGroup(actor)` | The squad combat group the actor's combatant belongs to in the current combat, or `null`. |
| `snapStamina(actor)` | A snapshot to undo damage with: `{ prevValue, prevTemp, squadGroup, prevSquadHP, squadCombatantIds, squadTokenIds }`. Take it before applying damage. |
| `undoDamage(actor, snapshot)` | Puts the actor's Stamina, temporary Stamina and its squad's Stamina pool back as the snapshot recorded them. |
| `damageBatch(fn)` | Runs `fn` and returns its result, marking that damage is being applied in a batch while it runs. Death Tracker waits for a batch to finish before deciding who dies, so wrap several damage applications that belong together. |

## Size, movement and forced movement

| Function | Returns |
|---|---|
| `sizeRank(size)` | A number that orders sizes from smallest to largest: 1T is 0, 1S 1, 1M 2, 1L 3, 2 is 4, 3 is 5, and so on. Takes a Draw Steel size `{ value, letter }`. |
| `canForcedMoveTarget(attacker, target, might = null)` | Whether `attacker` can force move `target`: its Might is at least 2 and at least the target's size, or it's at least as large. Pass `might` to use a different score. |
| `hasFly(actor)` | Whether the actor has a fly speed. |
| `canCurrentlyFly(actor)` | Whether it can fly right now: it has a fly speed, isn't prone or restrained, and its speed is above 0. |

## Abilities

| Function | Returns |
|---|---|
| `getItemDsid(item)` | The item's Draw Steel id, the stable name that doesn't change between copies of the same ability, or `null`. |
| `getItemRange(item, distance = null)` | The ability's reach in squares, read from its distance. For melee or ranged abilities it's the ranged number when the ability is set to ranged; lines, cubes and walls add their size to how far away they can be placed. |
| `isSelfAndSelf(ability, view = null)` | Whether the ability both targets and ranges as self. |
| `rangeEnforced()` | Whether range limits apply for this user: the `enforceAbilityRange` config is on, and the user isn't a Director with `gmBypassRangeEnforcement` on. |
| `MULTI_GRAB_LIMITS` | How many creatures the monster abilities that can grab more than one can hold, by Draw Steel id. |

## Power rolls

| Function | Returns |
|---|---|
| `tierOf(total)` | The tier a power roll total reaches: 11 or lower is tier 1, 12 to 16 tier 2, 17 or higher tier 3. |
| `parsePowerRollState(element)` | Reads the ability roll in a rendered chat message: `{ originalTotal, originalNet, baseFormula, baseTooltip, isCritical }`, where `originalNet` is 1 for a bane and -1 for an edge, and the formula has that bonus taken back out. `null` when the message has no ability roll. |

## Finding actors and monsters

| Function | Returns |
|---|---|
| `getActingActor(predicate = null)` | The actor the user is most likely acting as: a controlled token they own first, then their assigned character, then (for players) any token they own on the scene. With `predicate`, the first of those it accepts. |
| `monsterFilter` | Predicate builders for filtering actors, listed below. |

```js
import { monsterFilter as filter } from '../../draw-steel-ctlib/src/index.mjs';

const goblinMinions = game.actors.filter((a) => filter.keyword('goblin')(a) && filter.isMinion(a));
const onScene = canvas.tokens.placeables.filter(filter.onActor(filter.sameLevel(leader)));
```

| Predicate | Accepts an actor that |
|---|---|
| `keyword(kw)` | Has the monster keyword. |
| `organization(o)` | Has that organization, such as `'minion'` or `'leader'`. |
| `level(n)` | Is that level. |
| `type(t)` | Is that actor type. |
| `isMinion` | Is a minion. Use it as it is, without calling it. |
| `sameLevel(source)` | Shares the level of `source`, an actor or token. |
| `sameOrganization(source)` | Shares its organization. |
| `sameKeywords(source)` | Has exactly the same keywords. |
| `onActor(fn)` | Wraps an actor predicate so it takes tokens. |

## Related Pages

- [Permission-Safe Writes](Permission-Safe-Writes)
- [Utilities](Utilities)
