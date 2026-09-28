# Permission-Safe Writes

A player often needs to change a document they don't own: knocking back an enemy token, marking a monster, removing a condition someone else placed. Foundry refuses those writes. These functions make the write directly when the user owns the document, and otherwise ask the Director's client to make it over CTLib's socket.

```js
import { safeUpdate, safeToggleStatusEffect } from '../../draw-steel-ctlib/src/index.mjs';

await safeUpdate(enemyToken.document, { x: 400, y: 600 });
await safeToggleStatusEffect(enemyToken.actor, 'prone', { active: true });
```

**A Director must be logged in** for the socket route to work. With no GM connected, a player's write to a document they don't own fails, the same as it would without CTLib.

| Function | What it does |
|---|---|
| `safeUpdate(document, data, options = {})` | `document.update(data, options)`. Pass `{ teleport: true }` in `options` to move a token without an animated path: it becomes a Foundry `displace` movement to the new `x` and `y`. |
| `safeDelete(document, options = {})` | `document.delete(options)`. Does nothing if the document is already gone, and swallows errors, so deleting twice is harmless. |
| `safeCreateEmbedded(parent, type, data)` | `parent.createEmbeddedDocuments(type, data)`. Returns the created documents. |
| `safeSetFlag(document, scope, key, value)` | Sets a flag through `safeUpdate`. |
| `safeUnsetFlag(document, scope, key)` | Removes a flag key through `safeUpdate`. |
| `safeToggleStatusEffect(actor, statusId, options = {})` | `actor.toggleStatusEffect(statusId, options)`. Takes an Actor: Foundry's TokenDocument has no such method. |
| `safeTeleport(tokenDoc, x, y)` | Releases all controlled tokens, then moves the token with `safeUpdate`. |

## Flags on modules that aren't enabled

`document.setFlag`, `getFlag` and `unsetFlag` throw when the scope belongs to a module that isn't active. `safeSetFlag` and `safeUnsetFlag` write the flag path directly instead, so they work on any scope, including one left behind by a module the world has since turned off. To read such a flag without throwing, read the raw data: `doc.flags?.['other-module']?.key`.

## Deleting a key

Setting a nested key to `undefined` or merging an object never removes anything in Foundry. Deleting a key takes an instance of Foundry's `ForcedDeletion` operator in the update data.

| Function | What it does |
|---|---|
| `dropKey()` | A fresh `ForcedDeletion` instance. Put it where the key should go: `{ flags: { 'my-module': { marker: dropKey() } } }`. It must be an instance: the bare class deletes nothing, silently. |
| `dropKeyOverSocket()` | A plain marker object that stands in for `dropKey()` in data sent over a socket, where class instances don't survive. `safeUpdate`'s socket route turns it back into a deletion on the Director's side. |
| `reviveDropKeys(data)` | Walks `data` and turns every `dropKeyOverSocket()` marker into `dropKey()`. Use it in your own socket handlers if you send deletions yourself. |
| `DELETE_MARKER` | The property name the marker object uses. |

`safeUnsetFlag` handles all of this for you.

## Replaying an undo

`replayUndo(ops)` runs a list of recorded operations in order, each through the functions above, and logs and skips any entry that fails.

| `op` | Fields | Does |
|---|---|---|
| `'update'` | `uuid`, `data`, `options` | `safeUpdate` |
| `'delete'` | `uuid` | `safeDelete` |
| `'addTags'`, `'removeTags'` | `uuid`, `tags` | Tag changes, see [Materials and Tags](Materials-and-Tags) |
| `'status'` | `uuid` (an Actor), `effectId`, `active` | `safeToggleStatusEffect` |
| `'stamina'` | `uuid`, `prevValue`, `prevTemp`, `squadGroupUuid`, `prevSquadHP`, `wasDeadBefore` | Restores Stamina and the squad's pool. Skipped when `wasDeadBefore` is set. |

## Related Pages

- [Draw Steel Helpers](Draw-Steel-Helpers): `snapStamina` and `undoDamage` record and restore Stamina.
- [Using CTLib](Using-CTLib)
