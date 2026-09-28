# Materials and Tags

Draw Steel gives walls and objects a material that decides what it costs to break through them and how much it hurts. CTLib holds the materials and their rules, and the tags that mark which material a wall or tile is made of.

## Tags

A tag is a short text label on a wall, tile or token. When the [Tagger](https://foundryvtt.com/packages/tagger) module is active these functions use it; otherwise they keep the tags themselves in the `tags` flag under CTLib's scope, `draw-steel-ctlib`, so scenes built with or without Tagger read the same way. Tags kept under Combat Tools' scope by older versions are still read.

| Function | What it does |
|---|---|
| `hasTags(obj, tag)` | Whether `obj` has `tag`, or every tag in an array. |
| `getTags(obj)` | Every tag on `obj`. |
| `getByTag(tag)` | Every wall, tile and token in the current scene with `tag`. |
| `addTags(obj, tags)` | Adds an array of tags. Works for players too, through [Permission-Safe Writes](Permission-Safe-Writes). |
| `removeTags(obj, tags)` | Removes an array of tags. |

`obj` can be a placeable or its document.

Tags CTLib reads: a material name (`glass`, `wood`, `stone`, `metal`, or a custom material), `obstacle` for things that block movement, `broken` for an obstacle that has been broken through, and `wall-block-` followed by an id for the tile and walls of one wall block.

## Materials

| Name | What it is |
|---|---|
| `BASE_MATERIALS` | `['glass', 'wood', 'stone', 'metal']` |
| `getCustomMaterials()` | Materials the Director added: `{ name, icon, alpha }` each. From the `customMaterials` config. |
| `getAllMaterials()` | The base materials, then the custom ones. |
| `getMaterial(obj)` | The first material tag on `obj`, or `'wood'` when it has none. |
| `getMaterialIcon(name)` | The material's icon, falling back to stone's. |
| `getMaterialAlpha(name)` | How opaque a tile of that material is drawn, from 0 to 1. |
| `MATERIAL_ICONS` | Icons for the base materials, and `broken` for rubble. |
| `MATERIAL_ALPHA` | Default opacity per base material. |

### Rules

| Name | What it is |
|---|---|
| `MATERIAL_RULES()` | The current rules from the `materialRules` config: `{ cost, damage, alpha }` per material. |
| `MATERIAL_RULE_DEFAULTS` | The defaults: glass costs 1 and deals 3, wood 3 and 5, stone 6 and 8, metal 9 and 11. |
| `WALL_RESTRICTIONS()` | The current Foundry wall restrictions per material from the `wallRestrictions` config: `{ move, sight, light, sound }`. |
| `WALL_RESTRICTION_DEFAULTS` | The defaults: glass blocks only movement; the others block movement, sight and light. |

Combat Tools spends `cost` squares of a forced movement when a creature is forced through the material, and deals the creature `damage`.

## Related Pages

- [Grid and Walls](Grid-and-Walls)
- [Config and Services](Config-and-Services)
