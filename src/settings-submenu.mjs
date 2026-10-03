
const debugOn = (id) => !!id && game.settings.settings.has(`${id}.debugMode`) && game.settings.get(id, 'debugMode');

let _class = null;
export const settingsSubmenu = () => _class ??= class SettingsSubmenu extends ds.applications.api.DSApplication {
  static DEFAULT_OPTIONS = {
    classes:  ['draw-steel'],
    window:   { minimizable: false, resizable: true },
    position: { width: 640, height: 'auto' },
  };

  static PARTS = {
    form: { template: 'modules/draw-steel-ctlib/templates/settings-submenu.hbs' },
  };

  static get moduleId()         { return null; }
  static get choiceHintPrefix() { return null; }

  static get regularKeys() { return []; }

  static get debugKeys()   { return []; }
  static get enableKey()   { return null; }
  static get dependencies() { return {}; }

  async _prepareContext(_options) {
    const debugMode    = debugOn(this.constructor.moduleId);
    const debugEntries = debugMode ? this.constructor.debugKeys.map(k => this._buildEntry(k)).filter(Boolean) : [];
    return {
      items: [
        ...this._regularItems(),
        ...(debugEntries.length ? [{ isDebugHeader: true }] : []),
        ...debugEntries,
      ],
    };
  }

  _regularItems() {
    const entries = this.constructor.regularKeys.map(k => this._buildEntry(k));
    const result = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e) continue;
      if (e.isSectionHeader) {
        let hasContent = false;
        for (let j = i + 1; j < entries.length; j++) {
          if (entries[j]?.isSectionHeader) break;
          if (entries[j]) { hasContent = true; break; }
        }
        if (!hasContent) continue;
      }
      result.push(e);
    }
    return result;
  }

  _buildEntry(key) {

    if (key && typeof key === 'object') return key;
    const id  = this.constructor.moduleId;
    const def = game.settings.settings.get(`${id}.${key}`);
    if (!def) return null;
    if (!game.user.isGM && def.scope === 'world') return null;
    const value = game.settings.get(id, key);
    return {
      key,
      needsReload: !!def.requiresReload,
      name:           game.i18n.localize(def.name),
      hint:           game.i18n.localize(def.hint),
      isBoolean:      def.type === Boolean,
      isSelect:       !!def.choices,
      isRange:        !!def.range,
      isNumber:       def.type === Number && !def.range,
      isEnableToggle: key === this.constructor.enableKey,
      value,
      choices:   def.choices
        ? Object.entries(def.choices).map(([v, l]) => ({ value: v, label: game.i18n.localize(l), selected: v === value }))
        : null,
      range: def.range ?? null,
    };
  }

  _onRender(_context, _options) {
    setTimeout(() => this.setPosition({ height: 'auto' }), 0);
    const el = this.element;

    el.querySelectorAll('input[type="range"]').forEach(input => {
      const display = el.querySelector(`#dsct-sub-val-${input.name}`);
      if (display) input.addEventListener('input', () => { display.textContent = input.value; });
    });

    const enableKey = this.constructor.enableKey;
    if (enableKey) {
      const enableInput = el.querySelector(`[name="${enableKey}"]`);
      if (enableInput) {
        const syncDisabled = () => {
          const on = enableInput.checked;
          el.querySelectorAll('.form-group').forEach(grp => {
            const first = grp.querySelector('input, select');
            if (!first || first === enableInput) return;
            grp.classList.toggle('dsct-sub-disabled', !on);
            grp.querySelectorAll('input, select').forEach(i => { i.disabled = !on; });
          });
        };
        enableInput.addEventListener('change', syncDisabled);
        syncDisabled();
      }
    }

    
    
    const deps = this.constructor.dependencies ?? {};
    if (Object.keys(deps).length) {
      const masterOn = () => !enableKey || (el.querySelector(`[name="${enableKey}"]`)?.checked ?? true);
      const syncDeps = () => {
        for (const [child, spec] of Object.entries(deps)) {
          
          const invert = spec.startsWith('!');
          const parent = invert ? spec.slice(1) : spec;
          const parentInput = el.querySelector(`[name="${parent}"]`);
          const group = el.querySelector(`[name="${child}"]`)?.closest('.form-group');
          if (!parentInput || !group) continue;
          const off = (invert ? parentInput.checked : !parentInput.checked) || !masterOn();
          group.classList.toggle('dsct-sub-disabled', off);
          group.querySelectorAll('input, select').forEach(i => { i.disabled = off; });
        }
      };
      for (const parent of new Set(Object.values(deps).map(v => v.replace(/^!/, '')))) {
        el.querySelector(`[name="${parent}"]`)?.addEventListener('change', syncDeps);
      }
      if (enableKey) el.querySelector(`[name="${enableKey}"]`)?.addEventListener('change', syncDeps);
      syncDeps();
    }

    el.querySelectorAll('.dsct-fp-btn').forEach(btn => {
      const input   = el.querySelector(`[name="${btn.dataset.target}"]`);
      const preview = btn.closest('.form-fields')?.querySelector('.dsct-icon-preview');
      input?.addEventListener('input', () => { if (preview) preview.src = input.value; });
      btn.addEventListener('click', () => {
        new FilePicker({
          type: 'imagevideo',
          current: input?.value ?? '',
          callback: (path) => {
            if (input)   input.value = path;
            if (preview) preview.src = path;
          },
        }).render(true);
      });
    });

    const prefix = this.constructor.choiceHintPrefix;
    if (prefix) el.querySelectorAll('select[name]').forEach((select) => {
      const baseHint = select.closest('.form-group')?.querySelector('.hint');
      if (!baseHint) return;

      const key  = (value) => `${prefix}.${select.name}.choiceHint.${value}`;
      const text = (value) => {
        const line = game.i18n.localize(key(value));
        return line === key(value) ? '' : line;
      };
      if (![...select.options].some(o => text(o.value))) return;

      let line = baseHint.nextElementSibling;
      if (!line?.classList.contains('dsct-choice-hint')) {
        line = document.createElement('p');
        line.className = 'hint dsct-choice-hint';
        baseHint.after(line);
      }

      const sync = () => {
        const body = text(select.value);
        line.textContent = body;
        line.hidden = !body;
      };
      select.addEventListener('change', sync);
      sync();
    });

    el.querySelector('#dsct-sub-save-btn')?.addEventListener('click', async () => {
      await this._doSave();
      this.close();
    });
  }

  async _doSave() {
    const el        = this.element;
    const id        = this.constructor.moduleId;
    const debugMode = debugOn(this.constructor.moduleId);
    const allKeys   = [
      ...this.constructor.regularKeys,
      ...(debugMode ? this.constructor.debugKeys : []),
    ];
    const seen    = new Set();
    const entries = [];
    for (const k of allKeys) {
      if (!k || typeof k !== 'string' || seen.has(k)) continue;
      seen.add(k);
      const def   = game.settings.settings.get(`${id}.${k}`);
      if (!def) continue;
      const input = el.querySelector(`[name="${k}"]`);
      if (!input) continue;
      entries.push({ k, def, input });
    }

    const before = new Map(entries.map(({ k }) => [k, game.settings.get(id, k)]));

    for (const { k, def, input } of entries) {
      let value;
      if (def.type === Boolean) value = input.checked;
      else if (def.type === Number) value = Number(input.value);
      else value = input.value;
      await game.settings.set(id, k, value);
    }

    
    const needsReload = entries.some(({ k, def }) =>
      def.requiresReload && game.settings.get(id, k) !== before.get(k));
    if (needsReload) foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
  }
};

Handlebars.registerPartial('dsctReloadBadge', `
{{#if needsReload}}
<span class="dsct-reload-badge" data-tooltip="{{localize 'CTLIB.settings.reloadTooltip'}}">
  <i class="fas fa-rotate-right"></i> {{localize 'CTLIB.settings.reload'}}
</span>
{{/if}}`);
