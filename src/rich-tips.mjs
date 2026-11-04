

let _active = null;

export const TIP_CLASS = 'draw-steel dsct-rich-tip';

const esc = (text) => foundry.utils.escapeHTML(String(text ?? ''));

export function richTip({ title = '', category = '', body = '', html = '' } = {}) {
  const head = `<header class="metadata"><h3 class="name">${esc(title)}</h3>${category ? `<aside class="category"><h4>${esc(category)}</h4></aside>` : ''}</header>`;
  const content = html || (body ? `<p>${esc(body)}</p>` : '');
  return head + (content ? `<section class="content dsct-tip">${content}</section>` : '');
}

export function tipFrom(prefix, { title, category, body, data = {} } = {}) {
  const loc = (part) => {
    const id = `${prefix}.${part}`;
    return game.i18n.has(id) ? game.i18n.format(id, data) : '';
  };
  return { title: title ?? loc('title'), category: category ?? loc('category'), body: body ?? loc('body') };
}

export function setTip(el, spec) {
  if (!el) return el;
  const html = typeof spec === 'string' ? spec : richTip(spec);
  if (el.dataset.dsctTip === html) return el;
  el.dataset.dsctTip = html;
  el.dataset.dsctTipClass = TIP_CLASS;
  delete el.dataset.tooltip;
  el.removeAttribute('title');
  if (_active === el) _open(el);
  return el;
}

export function tipAttrs(spec) {
  const html = typeof spec === 'string' ? spec : richTip(spec);
  return `data-dsct-tip="${esc(html)}" data-dsct-tip-class="${TIP_CLASS}"`;
}

export function richifyTooltips(root, { category = '' } = {}) {
  for (const el of root?.querySelectorAll?.('[data-tooltip]') ?? []) {
    const raw = el.dataset.tooltip;
    if (!raw) continue;
    const label = (el.getAttribute('aria-label') || el.textContent || el.getAttribute('placeholder') || '').replace(/\s+/g, ' ').trim();
    setTip(el, textTip(game.i18n.has(raw) ? game.i18n.localize(raw) : raw, { label, category }));
  }
}

export function textTip(text, { label = '', category = '' } = {}) {
  const strip = (s) => String(s ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const lead = String(text ?? '').match(/^\s*<strong>([\s\S]*?)<\/strong>\s*(?:<br\s*\/?>)?([\s\S]*)$/i);
  if (lead) {
    const rest = lead[2].trim();
    return { title: strip(lead[1]), category, html: rest ? `<p>${rest}</p>` : '' };
  }
  const plainText = strip(text);
  const html = /<[a-z]/i.test(text ?? '') ? `<p>${text}</p>` : '';
  if (!label || label === plainText) return { title: plainText, category };
  return { title: label, category, body: html ? '' : text, html };
}

export function pillTip({ title = '', category = '', src = '', hint = '' } = {}) {
  const lines = [src ? game.i18n.format('CTLIB.tip.pillFrom', { source: src }) : '', hint].filter(Boolean);
  return richTip({ title, category, html: lines.map((line) => `<p>${esc(line)}</p>`).join('') });
}

const _chatAnchor = (el) => el.closest('.chat-message') ?? el.closest('.chat-log');

function _dodge(el) {
  const tip = game.tooltip?.tooltip;
  const anchor = _chatAnchor(el);
  if (!tip || !anchor) return;
  const left = anchor.getBoundingClientRect().left - tip.offsetWidth - 10;
  if (left >= 8) tip.style.left = `${left}px`;
}

function _open(el) {
  _active = el;
  const inChat = !!_chatAnchor(el);
  game.tooltip.activate(el, { html: el.dataset.dsctTip, cssClass: el.dataset.dsctTipClass, direction: inChat ? 'LEFT' : undefined });
  if (inChat) requestAnimationFrame(() => { if (_active === el) _dodge(el); });
}

function _close() {
  _active = null;
  game.tooltip.deactivate();
}

function _bind(doc) {
  doc.body.addEventListener('pointerover', (event) => {
    const el = event.target.closest?.('[data-dsct-tip]');
    if (el && el !== _active && el.dataset.dsctTip) setTimeout(() => { if (el.matches(':hover')) _open(el); }, 0);
  }, { passive: true });
  doc.body.addEventListener('pointerout', (event) => {
    if (!_active || _active.contains(event.relatedTarget)) return;
    if (event.target.closest?.('[data-dsct-tip]') === _active) _close();
  }, { passive: true });
}

export function registerRichTips() {
  Handlebars.registerHelper('richTip', (prefix, options) => {
    const { title, category, body, ...data } = options?.hash ?? {};
    return new Handlebars.SafeString(tipAttrs(tipFrom(prefix, { title, category, body, data })));
  });
  _bind(document);
  Hooks.on('openDetachedWindow', (_id, win) => { if (win?.document?.body) _bind(win.document); });
}
