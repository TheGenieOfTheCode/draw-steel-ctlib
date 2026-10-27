import { markRequirement } from './module-requirements.mjs';

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
  static get requires()     { return {}; }
  static get intro()        { return null; }

  async _prepareContext(_options) {
    const debugMode    = debugOn(this.constructor.moduleId);
    const debugEntries = debugMode ? this.constructor.debugKeys.map(k => this._buildEntry(k)).filter(Boolean) : [];
    const items = [
      ...this._regularItems(),
      ...(debugEntries.length ? [{ isDebugHeader: true }] : []),
      ...debugEntries,
    ].map(i => ({ ...i }));
    
    const deps = this.constructor.dependencies ?? {};
    const chips = [];
    let sec = -1;
    for (const item of items) {
      if (item.isSectionHeader || item.isDebugHeader) {
        item.secIndex = ++sec;
        if (item.isSectionHeader) chips.push({ index: sec, label: item.label });
        continue;
      }
      item.sec = sec;
      item.isSub = !!deps[item.key ?? item.id];
    }
    this._nestedMenus = items.filter(i => i.isNestedMenu && i.opens);
    return { items, chips: chips.length >= 4 ? chips : [], intro: this.constructor.intro };
  }

  _regularItems() {
    const entries = this.constructor.regularKeys.map(k => this._buildEntry(k));
    const result = [];
    for (let i = 0; i < entries.length; i++) {
      const e = entries[i];
      if (!e || (e.gmOnly && !game.user.isGM)) continue;
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
      isText:         def.type === String && !def.choices,
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

    const id = this.constructor.moduleId;
    const setGroup = (grp, off) => {
      grp.classList.toggle('dsct-sub-disabled', off);
      grp.querySelectorAll('input, select, button').forEach(i => { i.disabled = off; });
    };
    
    const isOn = (key) => {
      const input = el.querySelector(`[name="${key}"]`);
      if (input) return input.checked;
      return game.settings.settings.has(`${id}.${key}`) ? !!game.settings.get(id, key) : true;
    };

    const enableKey = this.constructor.enableKey;
    const enableInput = enableKey ? el.querySelector(`[name="${enableKey}"]`) : null;
    const masterOn = () => !enableKey || isOn(enableKey);
    if (enableKey) {
      const syncDisabled = () => {
        const on = masterOn();
        el.querySelectorAll('.dsct-sub-scroll > .form-group').forEach(grp => {
          if (grp.hasAttribute('data-free') || !grp.querySelector('input, select, button') || (enableInput && grp.contains(enableInput))) return;
          setGroup(grp, !on);
        });
      };
      enableInput?.addEventListener('change', syncDisabled);
      syncDisabled();
    }

    const deps = { ...this.constructor.requires, ...this.constructor.dependencies };
    if (Object.keys(deps).length) {
      const offOf = (key, seen = new Set()) => {
        const spec = deps[key];
        if (!spec || seen.has(key)) return false;
        seen.add(key);
        const invert = spec.startsWith('!');
        const parent = invert ? spec.slice(1) : spec;
        return (invert ? isOn(parent) : !isOn(parent)) || offOf(parent, seen);
      };
      const groupOf = (key) => (el.querySelector(`[name="${key}"]`) ?? el.querySelector(`#${CSS.escape(key)}`))?.closest('.form-group');
      const syncDeps = () => {
        for (const child of Object.keys(deps)) {
          const group = groupOf(child);
          if (group) setGroup(group, offOf(child) || !masterOn());
        }
      };
      for (const parent of new Set(Object.values(deps).map(v => v.replace(/^!/, '')))) {
        el.querySelector(`[name="${parent}"]`)?.addEventListener('change', syncDeps);
      }
      enableInput?.addEventListener('change', syncDeps);
      syncDeps();
    }

    for (const item of this._nestedMenus ?? []) {
      el.querySelector(`#${CSS.escape(item.id)}`)?.addEventListener('click', () => new item.opens().render(true));
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

    el.querySelectorAll('.form-group [name]').forEach((input) => {
      const def = game.settings.settings.get(`${id}.${input.name}`);
      if (def?.requiresModule) markRequirement(input.closest('.form-group'), null, def);
    });

    this._wireSearchAndChips(el);
    if (this.options.focusKey) this.focusSetting(this.options.focusKey);

    el.querySelector('#dsct-sub-save-btn')?.addEventListener('click', async () => {
      await this._doSave();
      this.close();
    });
  }

  _wireSearchAndChips(el) {
    const scroller = el.querySelector('.dsct-sub-scroll');
    const chips = [...el.querySelectorAll('.dsct-sub-chips button')];
    const headers = () => [...el.querySelectorAll('.dsct-sub-scroll > [data-sec]:is(h3, h4)')];
    const chipFor = (sec) => chips.find(b => b.dataset.sec === String(sec));
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

    
    
    let pinned = null;
    const top = el.querySelector('.dsct-sub-top');
    const spy = () => {
      top?.classList.toggle('dsct-sub-scrolled', scroller.scrollTop > 0);
      if (!chips.length) return;
      let on = pinned;
      if (on === null) for (const h of headers()) if (!h.hidden && h.offsetTop - scroller.offsetTop <= scroller.scrollTop + 8) on = h.dataset.sec;
      on ??= headers().find(h => !h.hidden)?.dataset.sec;
      for (const b of chips) b.classList.toggle('dsct-sub-chip-on', b.dataset.sec === on);
    };
    const unpin = () => { if (pinned === null) return; pinned = null; spy(); };
    for (const b of chips) {
      b.addEventListener('click', () => {
        const h = el.querySelector(`.dsct-sub-scroll > [data-sec="${b.dataset.sec}"]:is(h3, h4)`);
        if (!h) return;
        pinned = b.dataset.sec;
        scroller.scrollTo({ top: h.offsetTop - scroller.offsetTop - 4, behavior: reduced() ? 'auto' : 'smooth' });
        spy();
      });
    }
    scroller?.addEventListener('scroll', spy);
    for (const type of ['wheel', 'touchstart', 'pointerdown', 'keydown']) scroller?.addEventListener(type, unpin, { passive: true });

    const norm = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
    const groups = [...el.querySelectorAll('.dsct-sub-scroll > .form-group')];
    for (const g of groups) g.dataset.search = norm(`${g.querySelector('label')?.textContent} ${g.querySelector('.hint')?.textContent}`);
    const noMatch = el.querySelector('.dsct-sub-nomatch');
    el.querySelector('.dsct-sub-search')?.addEventListener('input', (event) => {
      const words = norm(event.target.value).split(/\s+/).filter(Boolean);
      const seen = new Set();
      for (const g of groups) {
        const hit = words.every(w => g.dataset.search.includes(w));
        g.hidden = !hit;
        if (hit) seen.add(g.dataset.sec);
      }
      for (const h of headers()) {
        const any = seen.has(h.dataset.sec);
        h.hidden = !!words.length && !any;
        chipFor(h.dataset.sec)?.classList.toggle('dsct-sub-chip-empty', !!words.length && !any);
      }
      if (noMatch) noMatch.hidden = !words.length || seen.size > 0;
      pinned = null;
      spy();
      this.setPosition({ height: 'auto' });
    });
    spy();
  }

  
  focusSetting(key) {
    const bare = String(key).replace(`${this.constructor.moduleId}.`, '');
    const group = this.element?.querySelector(`[name="${CSS.escape(bare)}"]`)?.closest('.form-group');
    const scroller = this.element?.querySelector('.dsct-sub-scroll');
    if (!group || !scroller) return;
    requestAnimationFrame(() => {
      scroller.scrollTop = group.offsetTop - scroller.offsetTop - 12;
      group.classList.remove('dsct-sub-flash');
      void group.offsetWidth;
      group.classList.add('dsct-sub-flash');
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
      if (!input || input.disabled && def.requiresModule) continue;
      entries.push({ k, def, input });
    }

    const before = new Map(entries.map(({ k }) => [k, game.settings.get(id, k)]));

    for (const { k, def, input } of entries) {
      let value;
      if (def.type === Boolean) value = input.checked;
      else if (def.type === Number) value = Number(input.value);
      else value = input.value;
      
      if (value === before.get(k)) continue;
      await game.settings.set(id, k, value);
    }

    
    const needsReload = entries.some(({ k, def }) =>
      def.requiresReload && game.settings.get(id, k) !== before.get(k));
    if (needsReload) foundry.applications.settings.SettingsConfig.reloadConfirm({ world: true });
  }
};

Handlebars.registerPartial('dsctReloadBadge', `
{{#if needsReload}}
<span class="dsct-reload-badge" {{richTip "CTLIB.tip.reload" body=(localize 'CTLIB.settings.reloadTooltip')}}>
  <i class="fas fa-rotate-right"></i> {{localize 'CTLIB.settings.reload'}}
</span>
{{/if}}`);
