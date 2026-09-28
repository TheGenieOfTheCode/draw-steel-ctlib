# Target Damage Panel

[Draw Steel: Target Damage](https://foundryvtt.com/packages/draw-steel-target-damage) adds a panel to ability messages for applying damage to each target. Several modules add to that panel, and the panel redraws often. CTLib watches it once for all of them and runs every module's additions in a fixed order, each time it's drawn or changes, so modules don't fight over it or each keep their own watcher.

Nothing runs unless Target Damage is active.

## registerPanelDecorator

```js
import { registerPanelDecorator, DSTD_ROW } from '../../draw-steel-ctlib/src/index.mjs';

registerPanelDecorator({
  id: 'my-module-badges',
  priority: 60,
  decorate: ({ message, root, panel, trigger }) => {
    if (!panel) return;
    for (const row of panel.querySelectorAll(DSTD_ROW)) addBadge(row);
  },
  ignore: ['.my-module-badge'],
});
```

| Option | Default | What it does |
|---|---|---|
| `id` | | A name for your decorator. Registering the same `id` again replaces it. |
| `priority` | `100` | Lower runs first. |
| `decorate` | | Called with `{ message, root, panel, trigger }`. May be async; the next decorator waits for it. |
| `onRender` | `true` | Run when the chat message is drawn. |
| `onMutation` | `true` | Run when the panel or a target row is added to the page afterwards. |
| `ignore` | `[]` | Selectors for elements your own decorator adds. Adding them doesn't trigger another run, which would otherwise loop. |

`message` is the ChatMessage, `root` its `li` element, `panel` the Target Damage panel inside it (or `null` when there isn't one yet), and `trigger` is `'render'` or `'mutation'`. Pop-out chat windows are watched too.

A decorator that throws is logged and skipped; the others still run.

**Your decorator runs many times on the same panel.** Make it safe to repeat: check for what you added before adding it again.

### Order of the family's decorators

Leave room between these when you choose a priority.

| Priority | Decorator | Module |
|---|---|---|
| 20 | `combat-tools-prelude` | Combat Tools |
| 30 | `death-tracker-early` | Death Tracker |
| 50 | `combat-tools-panel` | Combat Tools |
| 70 | `death-tracker-late` | Death Tracker |
| 100 | `combat-tools-forced-movement` | Combat Tools |

`describePanelDecorators()` lists what's registered, as `'priority id'` lines, for checking in the console.

## Reading the panel's state

`applicationSignature(message)` sums up what has been applied from the panel: `'applied/undone'`, counting damage and healing applications, or `null` when the message has no Target Damage state. Compare it between runs to notice that something was applied or undone.

## Selectors

| Name | Matches |
|---|---|
| `DSTD` | Target Damage's module id, `'draw-steel-target-damage'`. |
| `DSTD_PANEL` | The panel. |
| `DSTD_ROW` | One target's row, which carries the target in `data-target-key`. |

## Related Pages

- [Using CTLib](Using-CTLib)
