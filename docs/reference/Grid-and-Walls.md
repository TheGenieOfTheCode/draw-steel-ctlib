# Grid and Walls

Small helpers for moving between canvas pixels and grid squares, measuring between creatures the Draw Steel way, and asking what stands in a square.

Grid positions are `{ x, y }` in squares, counted from the top left of the scene. Canvas positions are `{ x, y }` in pixels.

## Squares and pixels

| Function | Returns |
|---|---|
| `GRID()` | The size of one square in pixels. |
| `toGrid(point)` | The square a canvas point is in. Works on a token document too, giving its top left square. |
| `toWorld(square)` | The pixel position of a square's top left corner. |
| `toCenter(square)` | The pixel position of a square's centre. |
| `gridEq(a, b)` | Whether two squares are the same. |
| `gridDist(a, b)` | Squares between two squares, counting diagonals as one. |

## Distance between creatures

Draw Steel measures from the nearest edges of two creatures' spaces, not their centres.

| Function | Returns |
|---|---|
| `tokFootprintDist(a, b)` | The distance between two tokens' spaces, in the scene's units. Two creatures side by side are one square apart. |
| `footprintDistFromBounds(aX, aY, aW, aH, bX, bY, bW, bH)` | The same from raw positions: `x` and `y` in pixels, width and height in squares. |

## What's in a square

| Function | Returns |
|---|---|
| `tokenAt(gx, gy, excludeId)` | The first token whose space covers the square, skipping the token with `excludeId`. Uses the creature's Draw Steel size. |
| `tileAt(gx, gy)` | The first tile whose top left corner is on the square. |
| `getTokenById(id)` | The token on the canvas with that id, or `null`. |

## Walls and doors

| Function | Returns |
|---|---|
| `wallBetween(from, to)` | The first wall that blocks movement between the centres of two adjacent squares, preferring walls tagged `obstacle`, or `null`. |
| `wallBlocksMovement(wall)` | Whether a wall stops movement: it has a movement restriction and isn't an open door. |
| `isOpenDoorWall(wall)` | Whether a wall is a door standing open. |
| `segmentsIntersect(ax, ay, bx, by, cx, cy, dx, dy)` | Whether two line segments cross. Touching ends don't count. |

### Wall blocks

A wall block is a tile standing for a solid square of wall, with the walls around its edges. The tile is tagged `obstacle`, and the tile and its walls share a tag starting `wall-block-`. See [Materials and Tags](Materials-and-Tags) for tags.

| Function | Returns |
|---|---|
| `getWallBlockTileAt(gx, gy)` | The wall block tile on a square, or `null`. |
| `getWallBlockWalls(tile)` | `{ blockTag, walls }`: the shared tag and the wall documents. |
| `getWallBlockBottom(tile)`, `getWallBlockTop(tile)` | The block's height range, from the Wall Height module's flags on its walls, or `null`. |
| `tileIsOpenDoor(tile)` | Whether every wall of the block is an open door. |

## Related Pages

- [Line of Effect and Cover](Line-of-Effect-and-Cover)
- [Materials and Tags](Materials-and-Tags)
