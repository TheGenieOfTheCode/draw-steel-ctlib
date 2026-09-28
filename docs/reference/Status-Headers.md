# Status Headers

The list of statuses on the token HUD is one long run of icons. CTLib splits it under headers so a Director can find things: Draw Steel's conditions first, then each module's own statuses under that module's name, then statuses from other modules, then Foundry's own.

Any module can put its statuses under a header of its own.

## registerStatusGroup

```js
import { registerStatusGroup } from '../../draw-steel-ctlib/src/index.mjs';

registerStatusGroup({
  key: 'my-module',
  label: 'MYMOD.statusGroup',
  order: 40,
  statuses: ['myModuleMarked', 'myModuleShaken'],
});
```

| Option | Default | What it does |
|---|---|---|
| `key` | | A name for the group. |
| `label` | | The header text, or a localization key for it. |
| `order` | `50` | Where the header goes; lower comes first. |
| `statuses` | `[]` | Status ids that belong to this group. |
| `match` | `null` | A function `(id) => boolean` for claiming a whole family of ids, such as every id with your prefix. |

A status listed in `statuses` goes to that group even when another group's `match` would also take it. That's how one module can take a single status out of another module's family. Register at any time before the HUD is first opened; top level or `init` is fine.

## The groups CTLib keeps

| Order | Header | Holds |
|---|---|---|
| 10 | Draw Steel | The system's conditions and Stamina states. |
| 80 | Other Modules | Anything no group claims. |
| 90 | Foundry | Dead, Asleep, Flying, Burrowing, Blind, Deaf and Invisible. |

The family's own: Combat Tools at 20, Death Tracker at 30. A header with no statuses under it isn't shown.

## Related Pages

- [Using CTLib](Using-CTLib)
