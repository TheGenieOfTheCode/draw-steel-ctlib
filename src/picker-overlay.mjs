import { setTip, tipAttrs, tipFrom } from './rich-tips.mjs';
import { reducedEffects } from './helpers.mjs';

let _ov = null;

const _holePad = () => Math.max(6, canvas.grid.size * 0.12);

function _tokenRects(tokens) {
  return tokens.filter(t => t?.document).map(t => ({
    x: t.x, y: t.y,
    w: t.document.width * canvas.grid.size,
    h: t.document.height * canvas.grid.size,
  }));
}

function _redrawGrey() {
  if (!_ov?.greyG) return;
  const d = canvas.dimensions;
  _ov.greyG.clear();
  _ov.greyG.beginFill(0x080810, 1);
  _ov.greyG.drawRect(d.rect.x, d.rect.y, d.rect.width, d.rect.height);
  _ov.greyG.endFill();

  _ov.holesG.clear();
  const pad = _holePad();
  const rects = _ov.holeRects.map(r => ({ x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 }));
  _ov.holesG.beginFill(0xffffff, 1);
  for (const r of rects) _ov.holesG.drawRoundedRect(r.x, r.y, r.w, r.h, pad);
  
  
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) {
      const a = rects[i], b = rects[j];
      const x0 = Math.max(a.x, b.x), y0 = Math.max(a.y, b.y);
      const x1 = Math.min(a.x + a.w, b.x + b.w), y1 = Math.min(a.y + a.h, b.y + b.h);
      if (x1 > x0 && y1 > y0) _ov.holesG.drawRect(x0, y0, x1 - x0, y1 - y0);
    }
  }
  _ov.holesG.endFill();
}

function _frameView(rects) {
  if (!rects?.length) return;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const r of rects) {
    x0 = Math.min(x0, r.x); y0 = Math.min(y0, r.y);
    x1 = Math.max(x1, r.x + r.w); y1 = Math.max(y1, r.y + r.h);
  }
  const pad = canvas.grid.size * 2;
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const screen = canvas.app.renderer.screen;
  const scale = Math.min(screen.width / (x1 - x0), screen.height / (y1 - y0), 1);
  canvas.animatePan({ x: (x0 + x1) / 2, y: (y0 + y1) / 2, scale, duration: 450 });
}

const RIGHT_CLICK_SLOP = 6;


export function watchRightClick(onRightClick) {
  let downAt = null;
  const onDown = (event) => { downAt = { x: event.global.x, y: event.global.y }; };
  const onUp = (event) => {
    const start = downAt;
    downAt = null;
    if (!start || Math.hypot(event.global.x - start.x, event.global.y - start.y) > RIGHT_CLICK_SLOP) return;
    onRightClick(event);
  };
  const onContextMenu = (event) => { if (event.target?.closest?.('#board')) event.preventDefault(); };
  canvas.stage.on('rightdown', onDown);
  canvas.stage.on('rightup', onUp);
  document.addEventListener('contextmenu', onContextMenu);
  return () => {
    canvas.stage?.off('rightdown', onDown);
    canvas.stage?.off('rightup', onUp);
    document.removeEventListener('contextmenu', onContextMenu);
  };
}


function _helpHtml({ controls, cancelOnRightClick, rightDragPans, scrollZooms }) {
  const loc = (s) => foundry.utils.escapeHTML(game.i18n.localize(s ?? ''));
  const row = (input, action) => `<dt>${loc(input)}</dt><dd>${loc(action)}</dd>`;
  const own = controls.filter(c => c?.input && c?.action).map(c => row(c.input, c.action));
  if (cancelOnRightClick) own.push(row('CTLIB.picker.help.rightClick', 'CTLIB.picker.help.cancel'));
  const map = [
    rightDragPans && row('CTLIB.picker.help.rightDrag', 'CTLIB.picker.help.pan'),
    row('CTLIB.picker.help.arrows', 'CTLIB.picker.help.pan'),
    scrollZooms && row('CTLIB.picker.help.scroll', 'CTLIB.picker.help.zoom'),
  ].filter(Boolean);
  const section = (heading, rows) => (rows.length ? `<h4>${loc(heading)}</h4>${rows.join('')}` : '');
  return `<dl class="dsct-picker-help-body">${section('CTLIB.picker.help.title', own)}${section('CTLIB.picker.help.map', map)}</dl>`;
}

export function beginPickerOverlay({ title, status = '', detail = '', tokens = [], holeRects = null, dim = true, hideUi = true, uiToggle = false, onUiToggle = null, showConfirm = true, showCancel = true, onConfirm = null, onCancel = null, frame = null, extraButtons = [], buttonGrid = false, controls = [], cancelOnRightClick = false, rightDragPans = true, scrollZooms = true, onRightClick = null } = {}) {
  endPickerOverlay();

  if (hideUi) document.body.classList.add('dsct-prominent-picker');

  const bar = document.createElement('div');
  bar.id = 'dsct-picker-topbar';
  const confirmLabel = game.i18n.localize('CTLIB.picker.confirm');
  const cancelLabel  = game.i18n.localize('CTLIB.picker.cancel');
  bar.innerHTML = `
    <span class="dsct-picker-title"></span>
    <span class="dsct-picker-status"></span>
    <span class="dsct-picker-btns">
      <button type="button" class="dsct-picker-uitoggle${hideUi ? ' dsct-active' : ''}" ${uiToggle ? '' : 'hidden'} ${tipAttrs(tipFrom('CTLIB.tip.toggleUi', { body: game.i18n.localize('CTLIB.picker.toggleUi') }))}><i class="fa-solid fa-eye-slash"></i></button>
      <button type="button" class="dsct-picker-confirm" ${showConfirm ? '' : 'hidden'}><i class="fa-solid fa-check"></i> ${confirmLabel} <kbd>Enter</kbd></button>
      <button type="button" class="dsct-picker-cancel" ${showCancel ? '' : 'hidden'}><i class="fa-solid fa-xmark"></i> ${cancelLabel} <kbd>Esc</kbd></button>
    </span>
    <span class="dsct-picker-detail" hidden></span>`;
  bar.querySelector('.dsct-picker-title').textContent = title ?? '';
  bar.querySelector('.dsct-picker-status').textContent = status ?? '';
  if (detail) {
    const detailEl = bar.querySelector('.dsct-picker-detail');
    detailEl.hidden = false;
    detailEl.textContent = detail;
  }
  const btnsEl = bar.querySelector('.dsct-picker-btns');
  if (buttonGrid) btnsEl.classList.add('dsct-btns-grid');
  const extraButton = (eb) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `dsct-picker-extra${eb.className ? ` ${eb.className}` : ''}`;
    b.innerHTML = `${eb.icon ? `<i class="${eb.icon}"></i> ` : ''}${foundry.utils.escapeHTML(eb.label ?? '')}${eb.kbd ? ` <kbd>${foundry.utils.escapeHTML(eb.kbd)}</kbd>` : ''}`;
    if (eb.tooltip) setTip(b, { title: eb.label ?? '', category: eb.tipCategory ?? '', body: eb.tooltip });
    b.addEventListener('click', (ev) => { ev.preventDefault(); eb.onClick?.(); });
    return b;
  };
  const stack = (ebs) => {
    const el = document.createElement('span');
    el.className = 'dsct-picker-stack';
    el.append(...ebs.map(extraButton));
    return el;
  };
  for (const eb of extraButtons) btnsEl.insertBefore(Array.isArray(eb) ? stack(eb) : extraButton(eb), btnsEl.querySelector('.dsct-picker-confirm'));
  const help = document.createElement('span');
  help.className = 'dsct-picker-help';
  help.textContent = '?';
  help.tabIndex = 0;
  help.ariaLabel = game.i18n.localize('CTLIB.picker.help.title');
  help.dataset.tooltipHtml = _helpHtml({ controls, cancelOnRightClick, rightDragPans, scrollZooms });
  help.dataset.tooltipDirection = 'DOWN';
  help.dataset.tooltipClass = 'dsct-picker-help-tip';
  btnsEl.appendChild(help);
  bar.querySelector('.dsct-picker-confirm').addEventListener('click', (e) => { e.preventDefault(); _ov?.onConfirm?.(); });
  bar.querySelector('.dsct-picker-cancel').addEventListener('click', (e) => { e.preventDefault(); _ov?.onCancel?.(); });
  bar.querySelector('.dsct-picker-uitoggle').addEventListener('click', (e) => {
    e.preventDefault();
    const hidden = document.body.classList.toggle('dsct-prominent-picker');
    e.currentTarget.classList.toggle('dsct-active', hidden);
    _ov?.onUiToggle?.(hidden);
  });
  document.body.appendChild(bar);

  let container = null, greyG = null, holesG = null;
  if (dim) {
    container = new PIXI.Container();
    greyG = new PIXI.Graphics();
    holesG = new PIXI.Graphics();
    holesG.blendMode = PIXI.BLEND_MODES.ERASE;
    container.addChild(greyG, holesG);
    container.alpha = 0.7;
    container.filters = [new PIXI.AlphaFilter()];
    canvas.controls.addChild(container);
    if (_arrowC && !_arrowC.destroyed) canvas.controls.addChild(_arrowC);
  }

  _ov = {
    bar, container, greyG, holesG,
    statusEl: bar.querySelector('.dsct-picker-status'),
    holeRects: holeRects ?? _tokenRects(tokens),
    lastStatus: status ?? '',
    warnTimer: null,
    onConfirm, onCancel, onUiToggle,
    stopRightClick: onRightClick ? watchRightClick(onRightClick) : null,
  };
  _redrawGrey();
  if (frame ?? dim) {
    _ov.prevView = { x: canvas.stage.pivot.x, y: canvas.stage.pivot.y, scale: canvas.stage.scale.x };
    _frameView(_ov.holeRects);
  }

  return {
    setStatus(text) {
      if (!_ov) return;
      _ov.lastStatus = text ?? '';
      if (_ov.warnTimer) return;
      _ov.statusEl.textContent = _ov.lastStatus;
      _ov.statusEl.classList.remove('dsct-warn');
    },
    flashWarning(text) {
      if (!_ov) { ui.notifications.warn(text); return; }
      clearTimeout(_ov.warnTimer);
      _ov.statusEl.textContent = text;
      _ov.statusEl.classList.add('dsct-warn');
      _ov.bar.classList.remove('dsct-shake');
      void _ov.bar.offsetWidth;
      _ov.bar.classList.add('dsct-shake');
      _ov.warnTimer = setTimeout(() => {
        if (!_ov) return;
        _ov.statusEl.textContent = _ov.lastStatus;
        _ov.statusEl.classList.remove('dsct-warn');
        _ov.bar.classList.remove('dsct-shake');
        _ov.warnTimer = null;
      }, 2500);
    },
    setReady(on) {
      _ov?.bar.classList.toggle('dsct-ready', !!on);
    },
    setTokens(list) {
      if (!_ov) return;
      _ov.holeRects = _tokenRects(list);
      _redrawGrey();
    },
    setHoleRects(rects) {
      if (!_ov) return;
      _ov.holeRects = [...rects];
      _redrawGrey();
    },
    end(focus = null) { endPickerOverlay(focus); },
  };
}

export function revealPickerUi() {
  document.body.classList.remove('dsct-prominent-picker');
  const toggle = document.querySelector('.dsct-picker-uitoggle');
  toggle?.classList.remove('dsct-active');
}

export function endPickerOverlay(focus = null) {
  if (!_ov) return;
  clearTimeout(_ov.warnTimer);
  _ov.stopRightClick?.();
  document.body.classList.remove('dsct-prominent-picker');
  _ov.bar.remove();
  if (_ov.container) {
    _ov.container.parent?.removeChild(_ov.container);
    _ov.container.destroy({ children: true });
  }
  if (_ov.prevView) {
    const view = focus ? { x: focus.x, y: focus.y, scale: _ov.prevView.scale } : _ov.prevView;
    canvas.animatePan({ ...view, duration: 450 });
  }
  _ov = null;
}

const _arrows  = new Map();
const _targets = new Map();
let _arrowC = null;
let _arrowG = null;
let _pathG = null;
let _arrowTickerFn = null;
let _arrowTime = 0;

function _ensureArrowLayer() {
  if (_arrowC && !_arrowC.destroyed) return;
  _arrowC = new PIXI.Container();
  _pathG = new PIXI.Graphics();
  _pathG.blendMode = PIXI.BLEND_MODES.ADD;
  _arrowG = new PIXI.Graphics();
  _arrowC.addChild(_pathG, _arrowG);
  canvas.controls.addChild(_arrowC);
}

function _ensureArrowTicker() {
  if (_arrowTickerFn) return;
  _arrowTime = 0;
  _arrowTickerFn = _arrowTick;
  canvas.app.ticker.add(_arrowTickerFn);
}

function _dispositionColor(token) {
  const dc = CONFIG.Canvas?.dispositionColors ?? {};
  switch (token.document?.disposition) {
    case CONST.TOKEN_DISPOSITIONS.FRIENDLY:
      return (token.actor?.hasPlayerOwner ? dc.PARTY : dc.FRIENDLY) ?? dc.FRIENDLY ?? 0x43dfdf;
    case CONST.TOKEN_DISPOSITIONS.HOSTILE:  return dc.HOSTILE ?? 0xe72124;
    case CONST.TOKEN_DISPOSITIONS.SECRET:   return dc.SECRET ?? 0xa612d4;
    default:                                return dc.NEUTRAL ?? 0xf1d836;
  }
}

function _drawArrowSet(g, token, color, alpha, m) {
  const GS = canvas.grid.size;
  const w = token.document.width * GS;
  const h = token.document.height * GS;
  const cx = token.x + w / 2;
  const cy = token.y + h / 2;
  const s    = GS * 0.3;
  const half = s * 0.4;
  const off  = 0.12 * m * GS;
  const lw   = 2 * (canvas.dimensions?.uiScale ?? 1);

  const tri = (tipX, tipY, dx, dy) => {
    const bx = tipX - dx * s;
    const by = tipY - dy * s;
    const px = -dy, py = dx;
    g.drawPolygon([tipX, tipY, bx + px * half, by + py * half, bx - px * half, by - py * half]);
  };

  g.lineStyle(lw, 0x000000, alpha);
  g.beginFill(color, alpha);
  tri(cx, token.y - off, 0, 1);
  tri(cx, token.y + h + off, 0, -1);
  tri(token.x - off, cy, 1, 0);
  tri(token.x + w + off, cy, -1, 0);
  g.endFill();
  g.lineStyle(0);
}

function _drawTargetSet(g, token, color, alpha) {
  const GS = canvas.grid.size;
  const w = token.document.width * GS;
  const h = token.document.height * GS;
  const x = token.x, y = token.y;
  const l = Math.min(w, h) * (CONFIG.Canvas?.targeting?.size ?? 0.15);
  const lw = 2 * (canvas.dimensions?.uiScale ?? 1);

  g.lineStyle(lw, 0x000000, alpha);
  g.beginFill(color, alpha);
  g.drawPolygon([x, y, x + l, y, x, y + l]);
  g.drawPolygon([x + w, y, x + w - l, y, x + w, y + l]);
  g.drawPolygon([x, y + h, x + l, y + h, x, y + h - l]);
  g.drawPolygon([x + w, y + h, x + w - l, y + h, x + w, y + h - l]);
  g.endFill();
  g.lineStyle(0);
}

function _arrowTick() {
  _arrowTime += canvas.app.ticker.elapsedMS;
  const duration = 1400, pause = duration * 0.55, fade = (duration - pause) * 0.25;
  const t  = _arrowTime % duration;
  let   dt = Math.max(0, t - pause) / (duration - pause);
  dt = Math.sqrt(1 - Math.pow(Math.min(dt, 1) - 1, 2));
  const m  = t < pause ? 0.5 : 0.5 + 0.5 * dt;
  const ta = Math.max(0, t - duration + fade);
  const a  = 1 - ta / fade;
  if (!_arrowG || _arrowG.destroyed) return;
  _arrowG.clear();
  for (const [, e] of _targets) {
    if (!e.token?.document || e.token.destroyed) continue;
    _drawTargetSet(_arrowG, e.token, e.color ?? _dispositionColor(e.token), e.alphaMult ?? 1);
  }
  for (const [, e] of _arrows) {
    if (!e.token?.document || e.token.destroyed) continue;
    _drawArrowSet(_arrowG, e.token, e.color ?? _dispositionColor(e.token), Math.max(0, a) * (e.alphaMult ?? 1), m);
  }
  _pathG?.clear();
  const plain = reducedEffects();
  const step = Math.min(1, canvas.app.ticker.elapsedMS / 180);
  for (const [id, e] of _paths) {
    if (plain || !_pathG) { _drawPath(_arrowG, e.points, e.color); continue; }
    
    const lit = e.lit || _arrows.has(id) || _targets.has(id) || (e.token && game.user.targets.has(e.token));
    e.level += ((lit ? 1 : 0) - e.level) * step;
    _drawFlow(_pathG, e, _arrowTime);
  }
}


function _flowCurve(points) {
  const GS = canvas.grid.size;
  const at = (p) => ({ x: (p.j + 0.5) * GS, y: (p.i + 0.5) * GS });
  const pts = points.map(at).filter((p, i, a) => {
    if (i === 0 || i === a.length - 1) return true;
    const b = a[i - 1], c = a[i + 1];
    return Math.sign(p.x - b.x) !== Math.sign(c.x - p.x) || Math.sign(p.y - b.y) !== Math.sign(c.y - p.y);
  });
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] ?? p2;
    const steps = Math.max(2, Math.ceil(Math.hypot(p2.x - p1.x, p2.y - p1.y) / 6));
    for (let k = 0; k < steps; k++) {
      const t = k / steps, t2 = t * t, t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (3 * b - a - 3 * c + d) * t3);
      out.push({ x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) });
    }
  }
  out.push({ ...pts.at(-1) });
  let len = 0;
  out.forEach((p, i) => {
    if (i) len += Math.hypot(p.x - out[i - 1].x, p.y - out[i - 1].y);
    p.s = len;
    const a = out[Math.max(0, i - 1)], b = out[Math.min(out.length - 1, i + 1)];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    p.nx = -(b.y - a.y) / d;
    p.ny = (b.x - a.x) / d;
  });
  return { pts: out, len };
}

const _mixColor = (a, b, f) => {
  const ch = (c, s) => (c >> s) & 0xff;
  return [16, 8, 0].reduce((out, s) => out | (Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * f) << s), 0);
};

const _strand = (g, pts, offset) => {
  pts.forEach((p, i) => {
    const o = offset(p);
    if (i) g.lineTo(p.x + p.nx * o, p.y + p.ny * o);
    else g.moveTo(p.x + p.nx * o, p.y + p.ny * o);
  });
};


function _drawFlow(g, e, time) {
  const { pts, len } = e.curve;
  if (pts.length < 2 || !len) return;
  const ui = canvas.dimensions?.uiScale ?? 1;
  const t = time / 1000 + e.seed;
  const lv = e.level;
  const light = _mixColor(e.color, 0xffffff, 0.5);
  
  const fadeIn = Math.min(45, len * 0.2), fadeOut = Math.min(30, len * 0.15);
  const taper = (s) => Math.max(0, Math.min(1, s / fadeIn, (len - s) / fadeOut));
  const drift = (p) => Math.sin(p.s * 0.035 - t * 0.9) * (1 + 2 * lv) * ui * taper(p.s);
  
  const colors = e.colors?.length ? e.colors : [e.color];
  const twist = colors.length > 1 ? colors : [colors[0], colors[0]];
  const strands = e.style === 'helix'
    ? twist.map((c, k) => ({ color: _mixColor(c, 0xffffff, 0.35),
      off: (p) => Math.sin(p.s * 0.06 - t * 1.6 + (k * 2 * Math.PI) / twist.length) * (4 + 3 * lv) * ui * taper(p.s) }))
    : [{ color: light, off: drift }];
  const along = e.style === 'helix' ? () => 0 : drift;

  if (lv > 0.02) {
    g.lineStyle({ width: 10 * ui, color: e.color, alpha: 0.08 * lv, cap: 'round', join: 'round' });
    _strand(g, pts, () => 0);
  }
  for (const s of strands) {
    g.lineStyle({ width: (1 + 0.4 * lv) * ui, color: s.color, alpha: 0.16 + 0.29 * lv, cap: 'round', join: 'round' });
    _strand(g, pts, s.off);
  }
  if (lv < 0.05) return;

  const spacing = 200, speed = 80, trail = 40;
  const head = (t * speed) % spacing;
  for (let i = 1; i < pts.length; i++) {
    const p = pts[i], q = pts[i - 1];
    const behind = (((head - p.s) % spacing) + spacing) % spacing;
    const glow = Math.exp(-behind / trail) * taper(p.s);
    if (glow < 0.05) continue;
    g.lineStyle({ width: (1.4 + 2 * glow) * ui, color: light, alpha: 0.4 * glow * lv, cap: 'round' });
    g.moveTo(q.x + q.nx * along(q), q.y + q.ny * along(q));
    g.lineTo(p.x + p.nx * along(p), p.y + p.ny * along(p));
  }
}


function _drawPath(g, points, color) {
  if (points.length < 2) return;
  const GS = canvas.grid.size;
  const lw = 3 * (canvas.dimensions?.uiScale ?? 1);
  const at = (p) => ({ x: (p.j + 0.5) * GS, y: (p.i + 0.5) * GS });
  const pts = points.map(at);
  g.lineStyle(lw + 2, 0x000000, 0.55);
  g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  g.lineStyle(lw, color, 0.9);
  g.moveTo(pts[0].x, pts[0].y);
  for (const p of pts.slice(1)) g.lineTo(p.x, p.y);
  const end = pts.at(-1), prev = pts.at(-2);
  const len = Math.hypot(end.x - prev.x, end.y - prev.y) || 1;
  const dx = (end.x - prev.x) / len, dy = (end.y - prev.y) / len, s = GS * 0.28;
  g.lineStyle(1, 0x000000, 0.8);
  g.beginFill(color, 0.95);
  g.drawPolygon([end.x, end.y, end.x - dx * s - dy * s * 0.5, end.y - dy * s + dx * s * 0.5, end.x - dx * s + dy * s * 0.5, end.y - dy * s - dx * s * 0.5]);
  g.endFill();
  g.lineStyle(0);
}

const _paths = new Map();


export function setPickerPath(token, points, color = 0xa060ff, { style = 'wisp', colors = null, key = null, lit = false } = {}) {
  _ensureArrowLayer();
  _paths.set(key ?? token.id, { token, points, color, style, colors, curve: _flowCurve(points), seed: Math.random() * 100, level: lit ? 1 : 0, lit });
  _ensureArrowTicker();
}


export function lightPickerPath(token, lit) {
  const e = token ? _paths.get(token.id) : null;
  if (e) e.lit = !!lit;
}

export function setPickerArrow(token, color = null, alphaMult = 1) {
  _ensureArrowLayer();
  const existing = _arrows.get(token.id);
  if (existing) { existing.color = color; existing.alphaMult = alphaMult; existing.token = token; return; }
  _arrows.set(token.id, { token, color, alphaMult });
  _ensureArrowTicker();
}

export function setPickerTarget(token, color = null, alphaMult = 1) {
  _ensureArrowLayer();
  const existing = _targets.get(token.id);
  if (existing) { existing.color = color; existing.alphaMult = alphaMult; existing.token = token; return; }
  _targets.set(token.id, { token, color, alphaMult });
  _ensureArrowTicker();
}

export function removePickerArrow(token) {
  if (!token) return;
  _arrows.delete(token.id);
  if (_arrows.size + _targets.size + _paths.size === 0) clearPickerArrows();
}

export function removePickerTarget(token) {
  if (!token) return;
  _targets.delete(token.id);
  if (_arrows.size + _targets.size + _paths.size === 0) clearPickerArrows();
}

export function clearPickerArrows() {
  _arrows.clear();
  _targets.clear();
  _paths.clear();
  if (_arrowTickerFn) { canvas.app.ticker.remove(_arrowTickerFn); _arrowTickerFn = null; }
  if (_arrowC) {
    _arrowC.parent?.removeChild(_arrowC);
    _arrowC.destroy({ children: true });
    _arrowC = null;
    _arrowG = null;
    _pathG = null;
  }
}
