# Pickers

When the user has to choose something on the canvas, CTLib gives you the same frame the Combat Tools pickers use: a bar across the top with a title, a status line and Confirm and Cancel buttons, the rest of the scene dimmed with holes cut around what matters, and the rest of Foundry's UI tucked away. You write the choosing; CTLib draws the frame.

Only one picker overlay is open at a time. Opening a new one closes the last.

## beginPickerOverlay

```js
import { beginPickerOverlay } from '../../draw-steel-ctlib/src/index.mjs';

const overlay = beginPickerOverlay({
  title: 'Mark a Target',
  status: 'Click a creature. Enter to confirm, Escape to cancel.',
  tokens: candidates,
  onConfirm: () => finish(true),
  onCancel:  () => finish(false),
});
```

| Option | Default | What it does |
|---|---|---|
| `title` | | Bold text at the left of the bar. |
| `status` | `''` | The instruction line. |
| `detail` | `''` | A second, smaller line under the bar. Hidden when empty. |
| `tokens` | `[]` | Tokens to cut holes around in the dimmed canvas. |
| `holeRects` | `null` | Holes as canvas rectangles `{ x, y, w, h }`, in place of `tokens`. |
| `dim` | `true` | Dim the canvas outside the holes. |
| `frame` | follows `dim` | Pan and zoom to fit the holes, then pan back when the picker ends. |
| `hideUi` | `true` | Hide Foundry's sidebar, controls and other UI while picking. |
| `uiToggle` | `false` | Show a button that brings the UI back and hides it again. |
| `onUiToggle` | `null` | Called with `true` when the UI is hidden, `false` when shown. |
| `showConfirm`, `showCancel` | `true` | Show those buttons. |
| `onConfirm`, `onCancel` | `null` | Called when a button is clicked. |
| `extraButtons` | `[]` | More buttons before Confirm: `{ label, icon, kbd, tooltip, className, onClick }`. |
| `buttonGrid` | `false` | Lay the buttons out in a grid, for pickers with many. |

The Confirm and Cancel buttons show Enter and Escape, but the overlay doesn't listen for keys: handle them in your picker and call the same functions.

It returns a handle:

| Method | What it does |
|---|---|
| `setStatus(text)` | Replace the status line. |
| `flashWarning(text)` | Show `text` in the status line in red with a shake, for 2.5 seconds, then go back to the status. |
| `setReady(on)` | Highlight Confirm, for when the choice is complete. |
| `setTokens(list)`, `setHoleRects(rects)` | Move the holes. |
| `end(focus)` | Close the overlay, the same as `endPickerOverlay`. |

## Closing and the UI

| Function | What it does |
|---|---|
| `endPickerOverlay(focus = null)` | Closes the overlay and pans back to where the view was. Pass a point `{ x, y }` to pan there instead. Safe to call when nothing is open. |
| `revealPickerUi()` | Brings Foundry's UI back without closing the picker, for when your picker opens a dialog. |

## Marks on tokens

Animated marks that sit on tokens during a pick.

| Function | What it does |
|---|---|
| `setPickerArrow(token, color = null, alphaMult = 1)` | Four pulsing arrows pointing in at the token: "this one could be chosen". |
| `setPickerTarget(token, color = null, alphaMult = 1)` | Four corner brackets, like Foundry's own targeting marks: "this one is chosen". |
| `removePickerArrow(token)`, `removePickerTarget(token)` | Remove one token's mark. |
| `clearPickerArrows()` | Remove every mark. Call it when your picker ends. |

`color` is a number such as `0x66aaff`. Leave it out and the mark takes the token's disposition colour, like Foundry's own target marks. `alphaMult` fades a mark, for candidates that are allowed but not suggested. Calling either again for the same token updates its colour and fade.

## Ready made pickers

### runColoredTokenPicker

`runColoredTokenPicker({ tokens, colorMap, hint })` asks the user to click one of `tokens`. Each is lit in its own colour from `colorMap`, a Map of token id to a CSS hex colour such as `'#d9a63f'`, and the hovered one brightens and gets arrows in its colour. It resolves with the chosen token, or `null` on Escape (or a right click, when the `cancelOnRightClick` config is on).

```js
const picked = await runColoredTokenPicker({
  tokens: eligible,
  colorMap: new Map(eligible.map((t) => [t.id, '#d9a63f'])),
  hint: 'Choose who takes the hit.',
});
```

It opens the picker bar with the title "Pick a Token" and `hint` as its status line.

### chooseFreeSquare

`chooseFreeSquare(token, landedOn = null, options = {})` asks the user where a creature ends up when it can't stay where it is: it rings the square around `token` (or around `landedOn`, the creature it fell onto) outward until it finds free squares, shows them in green with the blocked ones in red, draws an arrow to the hovered square, and resolves with the chosen grid square `{ x, y }`.

| Option | Default | What it does |
|---|---|---|
| `maxRadius` | `10` | How many rings out to look. |
| `forceOnCancel` | `false` | On Escape, resolve with the first free square instead of `null`. |
| `title`, `status` | CTLib's own | The bar's text. |

A square is free when no living creature and no unbroken obstacle tile is on it. It resolves `null` straight away when there's nowhere free.

### pickCanvasTarget

`pickCanvasTarget({ draw, hitTest, hint })` is a bare picker for anything that isn't a token: you decide what's under the pointer and how to draw it.

```js
const square = await pickCanvasTarget({
  hint: 'Pick a square.',
  hitTest: (point) => toGrid(point),
  draw: (graphics, hover) => { if (hover) graphics.beginFill(0x44cc44, 0.4).drawRect(hover.x * GRID(), hover.y * GRID(), GRID(), GRID()).endFill(); },
});
```

`hitTest(point)` gets the canvas point under the pointer and returns what's there, or `null`. `draw(graphics, hover)` redraws whenever that changes. A left click on something resolves with it; Escape resolves `null`, and so does a right click when the `cancelOnRightClick` config is on. `hint` shows as a notification when the picker opens. It uses no overlay bar: open one yourself if you want it.

## Asking a question

`stackedPrompt({ title, heading, options, width = 380, count = 1 })` is a small dialog of large buttons stacked one above the other, each with an image or icon, for a choice between a few named options.

```js
const answer = await stackedPrompt({
  title: 'Brace',
  heading: 'When the blow lands',
  options: [
    { action: 'stand', label: 'Stand your ground', img: 'icons/equipment/shield/heater-steel-worn.webp' },
    { action: 'roll', label: 'Roll with it', icon: 'fa-solid fa-person-running' },
  ],
});
```

It resolves with the chosen option's `action`, or `null` when the dialog is closed. With `count` above 1 the user picks that many, clicking an option again to unpick it, and it resolves with an array of actions in the order they were picked.

## Related Pages

- [Grid and Walls](Grid-and-Walls)
- [Config and Services](Config-and-Services)
