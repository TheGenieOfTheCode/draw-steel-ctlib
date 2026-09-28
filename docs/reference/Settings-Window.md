# Settings Window

`SettingsSubmenu` is a settings window built from settings you've already registered. List the keys, and it lays them out with the right control for each, saves them together, and asks to reload the world only when a setting that needs it actually changed. It's the window every Combat Tools module uses, so yours will look like theirs.

It extends Draw Steel's own application class, so it matches the system's look in both themes.

## A minimal window

```js
import { SettingsSubmenu } from '../../draw-steel-ctlib/src/index.mjs';

class MySettings extends SettingsSubmenu {
  static DEFAULT_OPTIONS = { id: 'my-module-settings', window: { title: 'My Module Settings' } };
  static get moduleId()    { return 'my-module'; }
  static get regularKeys() { return ['showDistances', 'distanceColour', 'fadeTime']; }
}

Hooks.once('init', () => {
  game.settings.register('my-module', 'showDistances', { name: 'Show Distances', hint: '...', scope: 'client', config: false, type: Boolean, default: true });
  // ...the other two
  game.settings.registerMenu('my-module', 'settings', {
    name: 'My Module', label: 'Configure', icon: 'fas fa-gear', type: MySettings, restricted: false,
  });
});
```

Register the settings with `config: false` so they only appear in your window.

## What to override

| Static getter | Default | What it does |
|---|---|---|
| `moduleId` | `null` | Your module's id. Required. |
| `regularKeys` | `[]` | The settings to show, in order. An entry can also be an object, see below. |
| `debugKeys` | `[]` | Settings shown under a Debug heading, only while your module has a `debugMode` setting and it's on. |
| `enableKey` | `null` | A master toggle: while it's off, every other setting in the window is greyed out. |
| `dependencies` | `{}` | `{ child: 'parent' }` greys `child` out while the `parent` checkbox is off. `'!parent'` greys it out while `parent` is on. |
| `choiceHintPrefix` | `null` | A localization prefix for a line under a dropdown that explains the chosen option, see below. |

A world setting is left out for players, so a window with `restricted: false` shows each user only what they may change.

## Controls

Each setting gets its control from how it's registered: a checkbox for `Boolean`, a dropdown when it has `choices`, a slider when it has `range`, a number box for any other `Number`, and a text box otherwise. A setting with `requiresReload: true` shows a Reload badge.

For an image path with a file browser and preview, override `_buildEntry`:

```js
_buildEntry(key) {
  const entry = super._buildEntry(key);
  if (entry && key === 'markerIcon') entry.isFilePicker = true;
  return entry;
}
```

`_buildEntry` returning `null` hides a setting, which is the place for conditions such as "only for players".

## Entries that aren't settings

Put an object in `regularKeys` to show something else:

| Object | Shows |
|---|---|
| `{ isSectionHeader: true, label }` | A heading. It's dropped when nothing follows it before the next heading. |
| `{ isNestedMenu: true, id, name, label, icon, hint }` | A button that opens another window. Wire the click yourself in `_onRender`, by `id`. |
| `{ isInfo: true, name, hint, isActive }` | A read-only line with an Active or Not Detected badge, for showing whether another module is present. |

## Explaining dropdown options

With `choiceHintPrefix` set to `'MYMOD.setting'`, a dropdown for the `mode` setting looks up `MYMOD.setting.mode.choiceHint.<value>` for the selected value and shows it under the hint, updating as the choice changes. Options with no such string show nothing extra.

## Adding behaviour

Override `_onRender(context, options)` and call `super._onRender(context, options)` first. The form is `this.element`, and each control's `name` is its setting key.

## Related Pages

- [Config and Services](Config-and-Services)
- [Using CTLib](Using-CTLib)
