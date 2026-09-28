# Utilities

The smaller pieces: theme colours, preview tokens, and a few helpers for Foundry's own objects.

## Theme colours

CTLib's stylesheet defines colour tokens that the family's windows and panels use, so your UI can match them. They're plain CSS custom properties on `:root`:

| Token | Used for |
|---|---|
| `--dsct-bg`, `--dsct-bg-inner`, `--dsct-bg-btn` | Panel, inset and button backgrounds. |
| `--dsct-border`, `--dsct-border-outer`, `--dsct-border-panel` | Borders. |
| `--dsct-text`, `--dsct-text-dim`, `--dsct-text-label`, `--dsct-text-active` | Text, faint text, labels, and the active choice. |
| `--dsct-accent`, `--dsct-accent-red`, `--dsct-accent-green` | Highlights, and warning and success colours. |

The stylesheet holds the light values. `initPalette()` sets the dark values when Foundry's interface is in its dark theme and the light values otherwise; call it once at `init` and again whenever the body's classes change:

```js
initPalette();
new MutationObserver(initPalette).observe(document.body, { attributeFilter: ['class'] });
```

## Preview tokens

Death Tracker can hide fallen creatures from the map. A token registered as a preview stays visible anyway, for a picker that needs to show a fallen creature while the user chooses.

| Function | What it does |
|---|---|
| `addPreviewToken(id)` | Keeps that token visible. |
| `removePreviewToken(id)` | Lets it hide again. |
| `clearPreviewTokens()` | Lets them all hide again. |
| `isPreviewToken(id)` | Whether it's registered. |

`setRaisedDeadVisible(on)` shows every hidden fallen token at once, as Death Tracker's Raise Dead picker does while it's open, and `isRaisedDeadVisible()` reads it back.

## Foundry helpers

| Function | Returns |
|---|---|
| `activateTokenLayer()` | Switches the canvas to the token layer. |
| `getWindowById(id)` | An open application window with that id, from either of Foundry's window registries, or `null`. |
| `normalizeCollection(collection)` | An array from an array, Set, Foundry Collection or plain object. |

## Related Pages

- [Pickers](Pickers)
- [Draw Steel Helpers](Draw-Steel-Helpers)
