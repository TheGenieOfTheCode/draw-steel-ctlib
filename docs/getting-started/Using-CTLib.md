# Using CTLib

CTLib is an ordinary Foundry module, so using it takes two steps: say your module needs it, then reach it from your code.

## Declare the dependency

Add CTLib to `relationships.requires` in your `module.json`. Foundry then offers to install it with your module, and won't let a world enable yours without it.

```json
"relationships": {
  "requires": [
    {
      "id": "draw-steel-ctlib",
      "type": "module",
      "manifest": "https://github.com/TheGenieOfTheCode/draw-steel-ctlib/releases/latest/download/module.json"
    }
  ]
}
```

CTLib brings socketlib with it, so you don't need to list socketlib yourself unless your own code uses it.

## Reach it from your code

There are two ways in. Both reach the same single copy of the library, so state such as a registered service or a picker in progress is shared whichever way a module gets there.

### Import it (recommended)

Import straight from CTLib's entry file with a path relative to your own file. Modules sit side by side in Foundry's `modules` folder, so from `modules/your-module/src/main.mjs` it is:

```js
import { safeUpdate, beginPickerOverlay, config, services } from '../../draw-steel-ctlib/src/index.mjs';
```

The browser loads each file once per address, and CTLib loads itself from that same file, so your import and CTLib's own code share one copy. This works from the moment your file runs, with no hook to wait for.

A tidy habit is one small file in your module that re-exports CTLib, so the relative path is written once:

```js
// src/ctlib.mjs
export * from '../../draw-steel-ctlib/src/index.mjs';
```

Then everywhere else: `import { safeUpdate } from './ctlib.mjs';`

A plain import fails if CTLib is missing, which takes your whole module down with it. That's what the `requires` entry above prevents. If your module only uses CTLib when it happens to be there, use a dynamic import inside a check instead:

```js
if (game.modules.get('draw-steel-ctlib')?.active) {
  const ctlib = await import('../../draw-steel-ctlib/src/index.mjs');
}
```

### Use the api object

Everything the entry file exports is also on `game.modules.get('draw-steel-ctlib').api`:

```js
const ctlib = game.modules.get('draw-steel-ctlib').api;
await ctlib.safeUpdate(token.document, { hidden: true });
```

CTLib sets this during its own `init` hook. Modules run their `init` hooks one after another, so yours may run first and find `api` still empty. Read it in `setup`, `ready` or later, or import instead.

## When things run

CTLib loads after the Draw Steel system, so its classes can build on the system's (the [Settings Window](Settings-Window) base extends Draw Steel's application class).

Registration calls, such as `config.define`, `services.provide`, `registerPanelDecorator` and `registerStatusGroup`, only store what you give them. They're safe at the top level of a file or in any hook. Calls that touch the canvas, the grid or documents need a ready canvas, the same as any Foundry code.

## Stability

CTLib is young and its version starts at 0.x. Names on these pages may still change between minor versions while the family of modules settles; changes will be listed in each release's notes. Anything not listed on these pages is internal and may change without notice.

## Related Pages

- [Config and Services](Config-and-Services)
- [Permission-Safe Writes](Permission-Safe-Writes)
