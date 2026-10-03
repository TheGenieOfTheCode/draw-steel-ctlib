const MODULE_ID = 'draw-steel-ctlib';
const MAX_ERRORS = 15;
const MAX_URL = 7500;

const _errors = [];
const firstLines = (stack, n = 6) => String(stack ?? '').split('\n').slice(0, n).join('\n');
const keepError = (kind, message, stack) => {
  _errors.push({ at: new Date().toISOString().slice(11, 19), kind, message: String(message ?? '').slice(0, 300), stack: firstLines(stack) });
  if (_errors.length > MAX_ERRORS) _errors.shift();
};

window.addEventListener('error', (e) => keepError('error', e.message, e.error?.stack ?? `${e.filename}:${e.lineno}`));
window.addEventListener('unhandledrejection', (e) => keepError('rejection', e.reason?.message ?? e.reason, e.reason?.stack));
Hooks.on('error', (location, error) => keepError(location, error?.message ?? error, error?.stack));

const L = (key, data) => (data ? game.i18n.format(`CTLIB.bugReport.${key}`, data) : game.i18n.localize(`CTLIB.bugReport.${key}`));

const usesCtlib = (m) => m.id === MODULE_ID || [...(m.relationships?.requires ?? [])].some((r) => r.id === MODULE_ID);

export const reportableModules = () => game.modules.filter((m) => m.active && usesCtlib(m) && issuesPage(m));
const unreleased = (m) => usesCtlib(m) && !issuesPage(m);

const short = (value) => {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  return text.length > 120 ? `${text.slice(0, 117)}...` : text;
};

const changedSettings = (moduleId) => {
  const lines = [];
  for (const def of game.settings.settings.values()) {
    if (def.namespace !== moduleId) continue;
    if (!def.config && (def.type === Array || def.type === Object)) continue;
    let value;
    try { value = game.settings.get(moduleId, def.key); } catch { continue; }
    const fallback = typeof def.default === 'function' ? undefined : def.default;
    if (JSON.stringify(value) === JSON.stringify(fallback)) continue;
    lines.push(`- \`${def.key}\` (${def.scope}): ${short(value)}`);
  }
  return lines;
};

const details = (summary, body) => `<details><summary>${summary}</summary>\n\n${body}\n\n</details>`;

const buildReport = async ({ moduleId, what, steps, reporter, withErrors }) => {
  const support = await foundry.applications.sidebar.apps.SupportDetails.generateSupportReport().catch(() => ({}));
  const family = reportableModules();
  const picked = family.filter((m) => !moduleId || m.id === moduleId);
  const others = game.modules.filter((m) => m.active && !family.includes(m) && !unreleased(m));

  const environment = [
    `- Foundry: ${support.coreVersion ?? game.version}`,
    `- System: ${game.system.title} ${game.system.version}`,
    `- Browser: ${support.client ?? navigator.userAgent}`,
    `- OS: ${support.os ?? navigator.platform}`,
    support.gpu ? `- GPU: ${support.gpu}` : null,
    support.performanceMode ? `- Performance mode: ${support.performanceMode}` : null,
    `- Reporter's role: ${game.user.isGM ? 'Director' : 'player'}`,
    reporter?.trim() ? `- Reported by: ${reporter.trim().slice(0, 60)}` : null,
  ].filter(Boolean).join('\n');

  const settings = picked.map((m) => {
    const lines = changedSettings(m.id);
    return `**${m.title}**\n${lines.length ? lines.join('\n') : '- all defaults'}`;
  }).join('\n\n');

  const parts = [
    `### What happened\n${what.trim() || '_not described_'}`,
    `### Steps to reproduce\n${steps.trim() || '_not given_'}`,
    `### Environment\n${environment}`,
    `### Draw Steel modules\n${family.map((m) => `- ${m.title} ${m.version}`).join('\n')}`,
    details('Settings changed from their defaults', settings),
    details(`Other active modules (${others.length})`, others.map((m) => `${m.id} ${m.version}`).join(', ') || 'none'),
  ];
  if (withErrors) {
    parts.push(details(`Recent errors (${_errors.length})`, _errors.length
      ? _errors.map((e) => `\`${e.at}\` ${e.kind}: ${e.message}\n\`\`\`\n${e.stack}\n\`\`\``).join('\n')
      : 'none'));
  }
  const full = parts.join('\n\n');
  const brief = parts.slice(0, 4).join('\n\n');
  return { full, brief, picked };
};

const KNOWN_URL = 'https://raw.githubusercontent.com/TheGenieOfTheCode/draw-steel-ctlib/main/src/known-issues.json';
const KNOWN_LOCAL = 'modules/draw-steel-ctlib/src/known-issues.json';
let _known = null;

const loadKnown = async () => {
  if (_known) return _known;
  const get = async (url, opts) => {
    const res = await fetch(url, opts);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data?.entries)) throw new Error('unexpected shape');
    return data.entries;
  };
  try { _known = await get(`${KNOWN_URL}?at=${Date.now()}`, { cache: 'no-store', signal: AbortSignal.timeout(4000) }); }
  catch {
    try { _known = await get(KNOWN_LOCAL); } catch { _known = []; }
  }
  return _known;
};

const termHit = (padded, words, term) => (term.includes(' ') ? padded.includes(` ${term}`) : words.some((w) => w.startsWith(term)));

export const suggestFixes = async (text, moduleId = null) => {
  const norm = String(text ?? '').toLowerCase().replace(/[‘’]/g, "'");
  if (norm.trim().length < 3) return [];
  const words = norm.split(/[^a-z0-9']+/).filter(Boolean);
  const padded = ` ${words.join(' ')} `;
  return (await loadKnown()).filter((e) => {
    const mod = e.module ? game.modules.get(e.module) : null;
    if (e.module && !mod?.active) return false;
    if (moduleId && e.module && e.module !== moduleId) return false;
    if (e.fixedIn && !foundry.utils.isNewerVersion(String(e.fixedIn), mod?.version ?? '0')) return false;
    return Array.isArray(e.match) && e.match.length > 0
      && e.match.every((group) => [].concat(group).some((t) => termHit(padded, words, String(t).toLowerCase())));
  }).slice(0, 3);
};

const settingReachable = (s) => {
  if (!s?.key) return false;
  if (s.menu) {
    const menu = game.settings.menus.get(s.menu);
    return !!menu && (!menu.restricted || game.user.isGM);
  }
  const def = game.settings.settings.get(`${s.module}.${s.key}`);
  return !!def && (def.scope !== 'world' || game.user.isGM);
};

const openSetting = async (s) => {
  let app;
  if (s.menu) {
    app = new (game.settings.menus.get(s.menu).type)();
    await app.render(true);
  } else {
    app = game.settings.sheet;
    await app.render(true);
  }
  const name = s.menu ? s.key : `${s.module}.${s.key}`;
  for (let i = 0; i < 20; i++) {
    await new Promise((r) => setTimeout(r, 100));
    const root = app.element;
    if (!s.menu) root?.querySelector(`[data-action="tab"][data-tab="${s.module}"], nav [data-tab="${s.module}"]`)?.click();
    const group = root?.querySelector(`[name="${name}"]`)?.closest('.form-group');
    if (!group) continue;
    group.scrollIntoView({ block: 'center' });
    group.classList.add('ctlib-bug-highlight');
    setTimeout(() => group.classList.remove('ctlib-bug-highlight'), 2500);
    return;
  }
};

const suggestionHTML = (e, i) => {
  const esc = foundry.utils.escapeHTML;
  const buttons = [
    settingReachable(e.setting) ? `<button type="button" data-suggestion="${i}" data-do="setting"><i class="fa-solid fa-sliders" inert></i> ${esc(L('openSetting'))}</button>` : '',
    e.link ? `<a class="button" href="${esc(e.link)}" target="_blank" rel="noopener"><i class="fa-solid fa-book" inert></i> ${esc(L('readMore'))}</a>` : '',
  ].join('');
  return `<div class="ctlib-bug-suggestion"><i class="fa-solid fa-lightbulb" inert></i><div><p>${esc(e.text ?? '')}</p>${buttons ? `<div class="ctlib-bug-suggestion-buttons">${buttons}</div>` : ''}</div></div>`;
};

const issuesPage = (mod) => {
  if (mod?.bugs) return String(mod.bugs).replace(/\/+$/, '');
  const repo = String(mod?.url ?? '').replace(/\/+$/, '');
  return /^https:\/\/github\.com\/[^/]+\/[^/]+$/.test(repo) ? `${repo}/issues` : '';
};

const issueUrl = (mod, title, body) => {
  const base = issuesPage(mod);
  if (!/github\.com\/.+\/issues$/.test(base)) return null;
  return `${base}/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
};

let _class = null;
const reportClass = () => _class ??= class BugReport extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'ctlib-bug-report',
    classes: ['ctlib-bug-report'],
    tag: 'form',
    window: { title: 'CTLIB.bugReport.title', icon: 'fa-solid fa-bug', resizable: true },
    position: { width: 560, height: 'auto' },
    actions: {
      copy: function () { return this._copy(); },
      issue: function () { return this._openIssue(); },
    },
  };

  static PARTS = { form: { template: 'modules/draw-steel-ctlib/templates/bug-report.hbs' } };

  async _prepareContext() {
    const preferred = this.options.moduleId ?? null;
    return {
      modules: reportableModules().map((m) => ({ id: m.id, label: `${m.title} ${m.version}`, selected: m.id === preferred })),
      errorCount: _errors.length,
    };
  }

  _fields() {
    const form = this.element;
    return {
      moduleId: form.querySelector('[name="module"]').value,
      what: form.querySelector('[name="what"]').value,
      steps: form.querySelector('[name="steps"]').value,
      reporter: form.querySelector('[name="reporter"]').value,
      withErrors: form.querySelector('[name="errors"]').checked,
    };
  }

  _onRender() {
    const el = this.element;
    const box = el.querySelector('.ctlib-bug-suggestions');
    let shown = [];
    const refresh = foundry.utils.debounce(async () => {
      const fields = this._fields();
      const ready = fields.what.trim().length > 0;
      for (const b of el.querySelectorAll('[data-action="copy"], [data-action="issue"]')) b.disabled = !ready;
      shown = await suggestFixes(`${fields.what}\n${fields.steps}`, fields.moduleId || null);
      box.hidden = !shown.length;
      box.innerHTML = shown.length ? `<p class="ctlib-bug-suggestions-title">${foundry.utils.escapeHTML(L('suggestions'))}</p>${shown.map(suggestionHTML).join('')}` : '';
      el.querySelector('.ctlib-bug-preview pre').textContent = (await buildReport(fields)).full;
      this.setPosition({ height: 'auto' });
    }, 300);
    box.addEventListener('click', (event) => {
      const btn = event.target.closest('[data-do="setting"]');
      if (!btn) return;
      event.preventDefault();
      const entry = shown[Number(btn.dataset.suggestion)];
      if (entry?.setting) openSetting({ module: entry.module, ...entry.setting });
    });
    const name = el.querySelector('[name="reporter"]');
    name.value = game.settings.get(MODULE_ID, 'bugReportName') ?? '';
    name.addEventListener('change', () => game.settings.set(MODULE_ID, 'bugReportName', name.value.trim()));
    el.addEventListener('input', refresh);
    el.addEventListener('change', refresh);
    refresh();
  }

  async _copy() {
    const { full } = await buildReport(this._fields());
    await game.clipboard.copyPlainText(full);
    ui.notifications.info(L('copied'));
  }

  async _openIssue() {
    const fields = this._fields();
    const { full, brief, picked } = await buildReport(fields);
    const mod = picked.length === 1 ? picked[0] : game.modules.get(MODULE_ID);
    const title = fields.what.trim().split('\n')[0].slice(0, 80);
    let url = issueUrl(mod, title, full);
    if (url && url.length > MAX_URL) {
      await game.clipboard.copyPlainText(full);
      url = issueUrl(mod, title, `${brief}\n\n${L('pasteBelow')}`);
      ui.notifications.info(L('tooLong'));
    }
    if (!url) {
      await game.clipboard.copyPlainText(full);
      ui.notifications.warn(L('noGithub', { module: mod?.title ?? MODULE_ID }));
      if (issuesPage(mod)) window.open(issuesPage(mod), '_blank', 'noopener');
      return;
    }
    window.open(url, '_blank', 'noopener');
  }
};

export const openBugReport = ({ moduleId = null } = {}) => new (reportClass())({ moduleId }).render(true);

const chatButton = () => {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ui-control icon fa-solid fa-bug ctlib-bug-report-button';
  btn.dataset.tooltip = L('button');
  btn.setAttribute('aria-label', L('button'));
  btn.addEventListener('click', (event) => { event.preventDefault(); openBugReport(); });
  return btn;
};

const addChatButton = (controls = document.getElementById('chat-controls')) => {
  if (!controls) return;
  controls.querySelector('.ctlib-bug-report-button')?.remove();
  let shown = true;
  try { shown = game.settings.get(MODULE_ID, 'bugReportChatButton'); } catch { /* not registered yet */ }
  if (!shown) return;
  let group = controls.querySelector('.control-buttons');
  if (!group) {
    group = document.createElement('div');
    group.className = 'control-buttons';
    controls.append(group);
  }
  group.append(chatButton());
};

Hooks.once('init', () => {
  game.settings.register(MODULE_ID, 'bugReportChatButton', {
    name: 'CTLIB.bugReport.settingName',
    hint: 'CTLIB.bugReport.settingHint',
    scope: 'client',
    config: true,
    type: Boolean,
    default: true,
    onChange: () => addChatButton(),
  });
  game.settings.register(MODULE_ID, 'bugReportName', { scope: 'client', config: false, type: String, default: '' });
});

Hooks.on('renderChatInput', (_app, elements) => addChatButton(elements?.['#chat-controls']));
Hooks.once('ready', () => addChatButton());

Hooks.on('renderSettings', (_app, html) => {
  const root = html instanceof HTMLElement ? html : html?.[0];
  const docs = root?.querySelector('section.documentation');
  if (!docs || docs.querySelector('.ctlib-bug-report-link')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ctlib-bug-report-link';
  btn.innerHTML = `<i class="fa-solid fa-bug" inert></i> ${foundry.utils.escapeHTML(L('button'))}`;
  btn.addEventListener('click', (event) => { event.preventDefault(); openBugReport(); });
  const support = docs.querySelector('[data-app="support"]');
  if (support) support.after(btn);
  else docs.append(btn);
});
