
export const DSTD = 'draw-steel-target-damage';
export const DSTD_PANEL = `section.${DSTD}-panel`;
export const DSTD_ROW = `.${DSTD}-target-row[data-target-key]`;
const DSTD_ROW_ANY = `.${DSTD}-target-row`;

const _decorators = [];
const _ignore = new Set();
let _started = false;
const _detached = new Map();

const dstdActive = () => !!game.modules.get(DSTD)?.active;

const DEFAULT_WATCH = [DSTD_PANEL, DSTD_ROW_ANY];

export const registerPanelDecorator = ({
  id, priority = 100, decorate, onRender = true, onMutation = true, ignore = [],
  watch = DEFAULT_WATCH, retry = [], immediate = false,
}) => {
  if (typeof decorate !== 'function') throw new TypeError(`CTLib | Target Damage panel | "${id}" needs a decorate function`);
  const at = _decorators.findIndex((d) => d.id === id);
  if (at >= 0) _decorators.splice(at, 1);
  _decorators.push({ id, priority, decorate, onRender, onMutation, watch, retry, immediate });
  _decorators.sort((a, b) => a.priority - b.priority);
  for (const selector of ignore) _ignore.add(selector);
  _start();
};

export const describePanelDecorators = () => _decorators.map((d) => `${d.priority} ${d.id}`);

export const applicationSignature = (message) => {
  const state = message?.flags?.[DSTD]?.state;
  if (!state) return null;
  let applied = 0;
  let undone = 0;
  for (const [id, a] of Object.entries(state.applications ?? {})) {
    if (!a || !(a.kind === 'damage' || a.kind === 'healing' || /^(damage|healing)-/.test(id))) continue;
    if (a.status === 'applied') applied++;
    else if (a.status === 'undone') undone++;
  }
  return `${applied}/${undone}`;
};

const _runOne = async (d, message, root, trigger) => {
  const panel = root?.querySelector(DSTD_PANEL) ?? null;
  try { await d.decorate({ message, root, panel, trigger }); }
  catch (err) { console.error(`CTLib | Target Damage panel | "${d.id}" failed:`, err); }
};

const _run = async (message, root, trigger, only = null) => {
  for (const d of _decorators) {
    if (trigger === 'render' ? !d.onRender : !d.onMutation) continue;
    if (only && !only.has(d)) continue;
    await _runOne(d, message, root, trigger);
  }
};

const _watches = (d, node) => d.watch === 'any'
  || d.watch.some((s) => node.matches?.(s) || node.querySelector?.(s));

const _ignored = (node) => [..._ignore].some((s) => node.matches?.(s) || node.closest?.(s));

const _onMutations = (mutations) => {
  if (!dstdActive()) return;
  const touched = new Map();
  const touch = (li, d) => {
    if (!touched.has(li)) touched.set(li, new Set());
    touched.get(li).add(d);
  };
  const watchers = _decorators.filter((d) => d.onMutation);
  const anyWatchers = watchers.filter((d) => d.watch === 'any');
  for (const mutation of mutations) {
    if (anyWatchers.length && mutation.target instanceof HTMLElement && !_ignored(mutation.target)) {
      const li = mutation.target.closest('li.chat-message[data-message-id]');
      if (li) for (const d of anyWatchers) touch(li, d);
    }
    for (const node of mutation.addedNodes) {
      if (node.nodeType !== Node.ELEMENT_NODE || _ignored(node)) continue;
      const li = node.closest?.('li.chat-message[data-message-id]');
      if (!li) continue;
      for (const d of watchers) if (_watches(d, node)) touch(li, d);
    }
  }
  for (const [li, only] of touched) {
    const message = game.messages.get(li.dataset.messageId);
    if (message) _run(message, li, 'mutation', only);
  }
};

const _observe = (doc) => {
  const log = doc.querySelector('#chat-log') ?? doc.querySelector('#chat') ?? doc.querySelector('[id$="-popout"]') ?? doc.body;
  const obs = new MutationObserver(_onMutations);
  obs.observe(log, { childList: true, subtree: true });
  return obs;
};

const _start = () => {
  if (_started) return;
  _started = true;

  Hooks.on('renderChatMessageHTML', (message, html) => {
    if (!_decorators.length || !dstdActive()) return;
    const root = html instanceof HTMLElement ? html : html?.[0];
    if (!root) return;
    const msgId = message.id;
    const live = () => root.isConnected
      ? root
      : (root.ownerDocument.querySelector(`li.chat-message[data-message-id="${msgId}"]`) ?? root);
    for (const d of _decorators) if (d.onRender && d.immediate) _runOne(d, message, root, 'render');
    setTimeout(() => _run(message, live(), 'render'), 0);
    for (const d of _decorators) {
      if (!d.onRender) continue;
      for (const ms of d.retry) setTimeout(() => { const el = live(); if (el.isConnected) _runOne(d, message, el, 'render'); }, ms);
    }
  });

  
  Hooks.on('openDetachedWindow', (id, win) => {
    setTimeout(() => { if (!_detached.has(id)) _detached.set(id, _observe(win.document)); }, 300);
  });
  Hooks.on('closeDetachedWindow', (id) => {
    _detached.get(id)?.disconnect();
    _detached.delete(id);
  });

  _observe(document);
};
