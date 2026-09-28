# Config and Services

Two small registries let modules share values and functions through CTLib without importing each other, so each one keeps working when the other is switched off.

## Config

`config` is a set of named values with a default each. One module declares the value; whichever module owns the matching setting supplies it; anyone reads it.

```js
import { config } from '../../draw-steel-ctlib/src/index.mjs';

config.define('showDistances', true);                                        // the default
config.provide('showDistances', () => game.settings.get('my-module', 'showDistances'));  // the live value
if (config.get('showDistances')) drawDistances();
```

| Function | What it does |
|---|---|
| `config.define(key, fallback)` | Declares `key` with a default. A second `define` of the same key is ignored, so the first default stands. |
| `config.provide(key, read)` | Supplies the live value through `read()`. A later `provide` replaces an earlier one. |
| `config.get(key)` | The provided value; if there's no provider, or it throws, the default. Object defaults come back as a copy, so changing the result never changes the default. |
| `config.describe()` | An object of every defined key, each marked `'provided'` or `'default'`. Handy in the console. |

Reading a key that was never defined returns `undefined` and logs one warning for that key. A provider that throws logs one warning and falls back to the default.

### Keys CTLib defines

CTLib's own helpers read these. Combat Tools provides all of them from its settings; without it, the defaults apply.

| Key | Default | Read by |
|---|---|---|
| `enforceAbilityRange` | `true` | `rangeEnforced()` |
| `gmBypassRangeEnforcement` | `false` | `rangeEnforced()` |
| `loeCornerMode` | `'normal'` | Line of effect sampling: `'restrictive'`, `'normal'` or `'generous'` |
| `trueDrawSteelLos` | `false` | Line of effect: check from every corner of the viewer's space rather than its centre |
| `stealthSystemEnabled` | `true` | `burrowBlocksLineOfEffect()` |
| `materialRules` | glass, wood, stone and metal costs, damage and opacity | [Materials and Tags](Materials-and-Tags) |
| `wallRestrictions` | per material sight, light, sound and movement | [Materials and Tags](Materials-and-Tags) |
| `customMaterials` | `[]` | [Materials and Tags](Materials-and-Tags) |
| `debugMode` | `false` | Extra console logging in a few helpers |
| `cancelOnRightClick` | `false` | `pickCanvasTarget()` |
| `autoConfirmSelection` | `false` | Pickers that can confirm themselves once the choice is complete |

## Services

`services` is a set of named functions. A module offers a function under a name; another calls it if it's there.

```js
import { services } from '../../draw-steel-ctlib/src/index.mjs';

services.provide('highlightSquad', (group) => { /* ... */ });

// elsewhere, in any module
await services.get('highlightSquad')?.(group);
```

| Function | What it does |
|---|---|
| `services.provide(name, fn)` | Offers `fn` under `name`. Throws if `fn` isn't a function. A later `provide` replaces an earlier one. |
| `services.get(name)` | The function, or `undefined` when nothing offers it. |
| `services.has(name)` | Whether anything offers it. |
| `services.describe()` | Every offered name, sorted. |

Always call through `?.`: a service is only there while the module that offers it is enabled.

### Services the family offers

These are how Combat Tools and Death Tracker reach each other. You're welcome to call them, but they belong to those modules and follow their needs, so treat them as less settled than CTLib's own functions.

| Service | Offered by |
|---|---|
| `applySquadLabels`, `applySquadLabelsAfterDeath` | Combat Tools |
| `captainCandidates`, `hasLiveCaptain`, `reassignSquadCaptain` | Combat Tools |
| `endGrab` | Combat Tools |
| `isHiddenFrom` | Combat Tools. CTLib's `getValidTargets` asks it whether a token is hidden from the caster |
| `resolveTokenVisibility` | Combat Tools |
| `deathTrackerActive`, `minionOverrideActive` | Death Tracker |
| `noteDamageCause`, `reportSquadDamage`, `resolveDeathsNow` | Death Tracker |
| `deathMessagesFor`, `deathSavedSquad`, `forgetDeathSavedSquad` | Death Tracker |
| `isHidingDefeated`, `markPendingRevival` | Death Tracker |

## Related Pages

- [Using CTLib](Using-CTLib)
- [Settings Window](Settings-Window)
