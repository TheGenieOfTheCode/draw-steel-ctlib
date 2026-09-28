# Line of Effect and Cover

These answer the questions Draw Steel asks constantly: can this creature see that one, does the target have cover, is that square concealed. They use Foundry's own sight walls, then add the things Foundry doesn't know about: creatures that block line of effect, low cover walls and objects, burrowing, and concealing areas.

## How a check is made

A creature looks from the centre of its space by default. With the `trueDrawSteelLos` config on, it looks from each corner of its space instead, and the best result counts.

It looks at points in the target's space: the centre and four corners of each square the target covers (only the corners, with `trueDrawSteelLos` on). The `loeCornerMode` config moves those corner points: `'restrictive'` pulls them 10% of a square inward, `'normal'` leaves them on the corners, and `'generous'` pushes them 10% outward. An outward point that would poke through a wall is pulled back inside.

## Tokens

| Function | Returns |
|---|---|
| `hasSightToToken(from, to, { shift })` | `true` when any line from `from` reaches any point of `to` past sight walls and blocking creatures, and burrowing or a range cap doesn't stop it. `shift` `{ x, y }` moves the viewer's origin, for asking "what if it stood there". |
| `hasCover(from, to)` | `true` when `to` has cover from `from`: at least half of the squares it fills are at least half hidden, by walls, blocking creatures, low cover walls or cover giving objects. `false` when `from` can't see `to` at all. |
| `visibleTargetCorners(from, to)` | How many corners of `to`'s space `from` can see, 0 to 4. |
| `sightLinesToToken(from, to, { all, shift })` | The lines themselves, for drawing: one per target point, the first clear line if there is one, else the first blocked one. With `all: true`, every origin to every point. |

Each line from `sightLinesToToken` is `{ from, to, blocked, hit, cell, sample }`, where `hit` is `{ t, x, y }`, the point where it stopped. A blocked line may also carry `blockedBy` (the blocking creature's name), `capped` (stopped by a range cap) or `burrowed` (stopped by the ground).

## Squares

For checks against an empty place rather than a creature, such as where someone could hide. Grid coordinates are squares, not pixels; see [Grid and Walls](Grid-and-Walls).

| Function | Returns |
|---|---|
| `hasSightToSquare(from, gx, gy)` | `true` when `from` can see any corner of the square. |
| `visibleSquareCorners(from, gx, gy, w = 1, h = 1)` | How many corners of the area `from` can see. |
| `footprintCoverCells(from, gx, gy, w = 1, h = 1)` | `{ blocked, total }`: how many squares of the area are at least half hidden. |
| `coveredInSquare(from, gx, gy, w, h, regions)` | `true` when a creature of that size there would have cover or concealment from `from`. |
| `seenPlainlyInSquare(from, gx, gy, w, h, regions)` | The opposite: in view with neither. |
| `atLeastHalfBlocked(visible, total)` | The rule both use: `visible * 2 <= total`. |

## Concealment

| Function | Returns |
|---|---|
| `concealingRegions()` | Scene regions that conceal: visible, with an enabled Combat Tools status effect behaviour that applies magical or mundane concealment, or invisibility. |
| `squareIsConcealed(gx, gy, regions)` | Whether the square's centre lies in one. Pass `regions` from `concealingRegions()` when checking many squares. |

## Burrowing

A creature is burrowing when it has the `burrow` status. How deep it is comes from the ground height under it, which is 0 unless Terrain Designer is active and has raised that square.

| Function | Returns |
|---|---|
| `isBurrowing(token)` | Has the `burrow` status. |
| `groundElevation(token)` | The ground height under the token. |
| `burrowDepth(token)` | How far below the ground it is, 0 when not burrowing. |
| `isCompletelyBeneath(token)` | Burrowing at least as deep as it is tall. |
| `touchesGround(token)` | Burrowing, but no deeper than it is tall. |
| `isOnGround(token)` | Standing exactly at ground height. |
| `burrowAdjacent(a, b)` | Within one square of each other and within 1 of each other's elevation. |
| `burrowBlocksLineOfEffect(from, to)` | Whether the ground between them blocks line of effect. Always `false` when the `stealthSystemEnabled` config is off. |

## What creatures and walls carry

Creatures and walls change these checks through flags. Combat Tools writes them from its sheet options; these functions read them. They live under the `draw-steel-combat-tools` flag scope. Reading them is always safe, even when Combat Tools is off.

| Flag on the Actor | Read by | Meaning |
|---|---|---|
| `loe.blocksForEnemies` | `loeBlockersFor(from, to)` | The creature blocks line of effect for creatures of another disposition. |
| `loe.rangeCap` | `loeRangeCap(token)`, `loeRangeBlocked(from, to)` | This creature only sees creatures closer than that many squares. |
| `loe.grantsCoverBehind` | `grantsCoverBehind(token)` | Creatures behind it have cover. |
| `loe.coverGrantsImmunity` | `grantsCoverImmunity(token)` | Allies it gives cover to gain damage immunity, see below. |
| `cover` | `tokenCoverMode(token)` | `'none'`, `'low'` or `'full'`. Unset, objects count as `'low'` and everything else as `'none'`. `'full'` blocks line of effect like a wall. |

| Flag on the Wall | Read by | Meaning |
|---|---|---|
| `lowCover` | `wallGrantsCover(wall)` | The wall gives cover without blocking sight. |

`coverObstaclesFor(from, to)` gathers the low cover walls and cover giving creatures for a check, and `segmentBlockedByCover(a, b, obstacles)` tests one line against them. `fullCoverBlockersFor(from, to)` lists the creatures in full cover mode. `LOE_KEY` and `COVER_KEY` hold the flag names.

### Cover that grants immunity

| Function | What it does |
|---|---|
| `coverImmunityGrantor(source, target)` | The creature giving `target` cover from `source` that grants immunity, or `null`. |
| `armCoverImmunity(actor, source)` | Gives `actor` an effect with damage immunity equal to that creature's highest characteristic, or switches the effect off when there's no such cover. |
| `disarmCoverImmunity(actor)` | Switches the effect off. |
| `highestCharacteristic(actor)` | The actor's highest characteristic score. |

## Walls and sight, underneath

| Function | Returns |
|---|---|
| `segmentBlocksSight(from, to)` | Whether a sight wall crosses the line between two canvas points. |
| `sightBlockPoint(from, to)` | Where the first sight wall crosses it, `{ t, x, y }`, or `null`. |
| `sightSamplePoints(token)` | Every point the checks look at in a token's space. |
| `sightOriginPoints(token, { shift })` | The points a token looks from. |
| `refreshLoeCornerMode()` | Re-reads `loeCornerMode`. Call it when you change that setting mid-session. |

## Related Pages

- [Grid and Walls](Grid-and-Walls)
- [Config and Services](Config-and-Services)
