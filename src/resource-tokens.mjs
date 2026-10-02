
const STYLES = {
  heroic:     { face: ['#e3b8ff', '#a45de0', '#5d2296', '#2e0c55'], sheen: '230,200,255', base: '#120518', notch: '#08020c', ink: '#14041f', rim: 'rays' },
  surges:     { face: ['#ffd27a', '#f39a1e', '#a45708', '#5a2c02'], sheen: '255,230,170', base: '#160b02', notch: '#0b0501', ink: '#1d0d00', rim: 'teeth' },
  heroTokens: { face: ['#fff0a8', '#f2c94a', '#a87c10', '#5e4204'], sheen: '255,250,210', base: '#151002', notch: '#0a0801', ink: '#231803', rim: 'milled' },
  recovery:   { face: ['#a8f5c4', '#3fc77a', '#177a43', '#08401f'], sheen: '210,255,225', base: '#03140a', notch: '#010a05', ink: '#04200f', rim: 'notches' },
  stamina:    { face: ['#ffc0c8', '#f2697e', '#a92a45', '#5c0f22'], sheen: '255,215,220', base: '#160309', notch: '#0b0104', ink: '#24030d', rim: 'notches' },
  temporary:  { face: ['#a8eef0', '#3cb9c4', '#16707a', '#083c42'], sheen: '210,250,250', base: '#031214', notch: '#010909', ink: '#032024', rim: 'notches' },
};

function drawMalice(ctx, x, y, r) {
  const Fr = r * 0.76;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fillStyle = '#1a0202'; ctx.fill();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.87, y + Math.sin(a) * r * 0.87, r * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = '#0c0101'; ctx.fill();
  }
  ctx.fillStyle = '#7a0808';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(x + s * Fr * 0.28, y - Fr * 0.96);
    ctx.bezierCurveTo(x + s * Fr * 0.40, y - Fr * 1.18, x + s * Fr * 0.70, y - Fr * 1.22, x + s * Fr * 0.90, y - Fr * 1.10);
    ctx.bezierCurveTo(x + s * Fr * 0.90, y - Fr * 0.85, x + s * Fr * 0.68, y - Fr * 0.70, x + s * Fr * 0.54, y - Fr * 0.83);
    ctx.closePath(); ctx.fill();
  }
  ctx.beginPath(); ctx.arc(x, y, Fr, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x - Fr * 0.18, y - Fr * 0.28, 0, x, y, Fr);
  g.addColorStop(0, '#de2828'); g.addColorStop(0.38, '#b01414'); g.addColorStop(0.72, '#7a0c0c'); g.addColorStop(1, '#480606');
  ctx.fillStyle = g; ctx.fill();
  sheen(ctx, x, y, Fr, '255,180,180');
  ctx.save();
  ctx.lineCap = 'round'; ctx.strokeStyle = '#080101'; ctx.lineWidth = Fr * 0.155;
  ctx.beginPath(); ctx.moveTo(x - Fr * 0.56, y - Fr * 0.38); ctx.quadraticCurveTo(x - Fr * 0.36, y - Fr * 0.26, x - Fr * 0.14, y - Fr * 0.16); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x + Fr * 0.14, y - Fr * 0.16); ctx.quadraticCurveTo(x + Fr * 0.36, y - Fr * 0.26, x + Fr * 0.56, y - Fr * 0.38); ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#080101';
  ctx.beginPath(); ctx.ellipse(x - Fr * 0.32, y - Fr * 0.06, Fr * 0.17, Fr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.ellipse(x + Fr * 0.32, y - Fr * 0.06, Fr * 0.17, Fr * 0.12, 0, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.moveTo(x - Fr * 0.42, y + Fr * 0.28); ctx.quadraticCurveTo(x, y + Fr * 0.52, x + Fr * 0.42, y + Fr * 0.28);
  ctx.strokeStyle = '#080101'; ctx.lineWidth = Fr * 0.135; ctx.lineCap = 'round'; ctx.stroke();
}

function sheen(ctx, x, y, Fr, rgb, lx = -0.14) {
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, Fr, 0, Math.PI * 2); ctx.clip();
  const sh = ctx.createRadialGradient(x + Fr * lx, y - Fr * 0.48, 0, x + Fr * lx, y - Fr * 0.48, Fr * 0.62);
  sh.addColorStop(0, `rgba(${rgb},0.52)`); sh.addColorStop(0.45, `rgba(${rgb},0.16)`); sh.addColorStop(1, `rgba(${rgb},0)`);
  ctx.fillStyle = sh; ctx.fillRect(x - Fr, y - Fr, Fr * 2, Fr * 0.74);
  ctx.restore();
}

function rim(ctx, x, y, r, s) {
  ctx.fillStyle = s.base;
  if (s.rim === 'rays') {
    ctx.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 - Math.PI / 2;
      const rr = i % 2 === 0 ? r : r * 0.86;
      ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    ctx.closePath(); ctx.fill();
    return;
  }
  if (s.rim === 'teeth') {
    ctx.beginPath(); ctx.arc(x, y, r * 0.93, 0, Math.PI * 2); ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a - 0.17) * r * 0.9, y + Math.sin(a - 0.17) * r * 0.9);
      ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
      ctx.lineTo(x + Math.cos(a + 0.17) * r * 0.9, y + Math.sin(a + 0.17) * r * 0.9);
      ctx.closePath(); ctx.fill();
    }
    return;
  }
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  if (s.rim === 'milled') {
    ctx.strokeStyle = s.notch; ctx.lineWidth = Math.max(1, r * 0.035);
    for (let i = 0; i < 36; i++) {
      const a = (i / 36) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.82, y + Math.sin(a) * r * 0.82);
      ctx.lineTo(x + Math.cos(a) * r * 0.98, y + Math.sin(a) * r * 0.98);
      ctx.stroke();
    }
    return;
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(x + Math.cos(a) * r * 0.87, y + Math.sin(a) * r * 0.87, r * 0.07, 0, Math.PI * 2);
    ctx.fillStyle = s.notch; ctx.fill();
  }
}

function star(ctx, x, y, outer, inner, points, rot = -Math.PI / 2) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = rot + (i / (points * 2)) * Math.PI * 2;
    const rr = i % 2 === 0 ? outer : inner;
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  ctx.closePath(); ctx.fill();
}

function heart(ctx, x, y, s) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.62);
  ctx.bezierCurveTo(x - s * 1.05, y - s * 0.05, x - s * 0.55, y - s * 0.78, x, y - s * 0.32);
  ctx.bezierCurveTo(x + s * 0.55, y - s * 0.78, x + s * 1.05, y - s * 0.05, x, y + s * 0.62);
  ctx.closePath(); ctx.fill();
}

const EMBLEMS = {
  heroic(ctx, x, y, Fr, ink) {
    ctx.fillStyle = ink;
    star(ctx, x, y + Fr * 0.02, Fr * 0.62, Fr * 0.16, 4);
    for (const [dx, dy] of [[-0.42, -0.42], [0.42, 0.42]]) { ctx.beginPath(); ctx.arc(x + dx * Fr, y + dy * Fr, Fr * 0.07, 0, Math.PI * 2); ctx.fill(); }
  },
  surges(ctx, x, y, Fr, ink) {
    ctx.strokeStyle = ink; ctx.lineWidth = Fr * 0.2; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const dy of [0.2, -0.22]) {
      ctx.beginPath();
      ctx.moveTo(x - Fr * 0.42, y + Fr * (dy + 0.2));
      ctx.lineTo(x, y + Fr * (dy - 0.18));
      ctx.lineTo(x + Fr * 0.42, y + Fr * (dy + 0.2));
      ctx.stroke();
    }
  },
  heroTokens(ctx, x, y, Fr, ink) { ctx.fillStyle = ink; star(ctx, x, y + Fr * 0.05, Fr * 0.6, Fr * 0.25, 5); },
  recovery(ctx, x, y, Fr, ink) {
    ctx.fillStyle = ink;
    const w = Fr * 0.22, l = Fr * 0.58;
    ctx.beginPath(); ctx.roundRect(x - w, y - l, w * 2, l * 2, w * 0.4); ctx.fill();
    ctx.beginPath(); ctx.roundRect(x - l, y - w, l * 2, w * 2, w * 0.4); ctx.fill();
  },
  stamina(ctx, x, y, Fr, ink) { ctx.fillStyle = ink; heart(ctx, x, y - Fr * 0.02, Fr * 0.9); },
  temporary(ctx, x, y, Fr, ink) {
    ctx.fillStyle = ink;
    ctx.beginPath();
    const dy = Fr * 0.03;
    ctx.moveTo(x, y - Fr * 0.62 + dy);
    ctx.lineTo(x + Fr * 0.5, y - Fr * 0.42 + dy);
    ctx.quadraticCurveTo(x + Fr * 0.5, y + Fr * 0.3 + dy, x, y + Fr * 0.64 + dy);
    ctx.quadraticCurveTo(x - Fr * 0.5, y + Fr * 0.3 + dy, x - Fr * 0.5, y - Fr * 0.42 + dy);
    ctx.closePath(); ctx.fill();
  },
};

export const RESOURCE_TOKENS = Object.freeze(['malice', ...Object.keys(STYLES)]);

export function drawResourceToken(ctx, key, x, y, r) {
  if (key === 'malice') return drawMalice(ctx, x, y, r);
  const s = STYLES[key];
  if (!s) return;
  rim(ctx, x, y, r, s);
  const Fr = r * 0.76;
  ctx.beginPath(); ctx.arc(x, y, Fr, 0, Math.PI * 2);
  const g = ctx.createRadialGradient(x, y - Fr * 0.28, 0, x, y, Fr);
  g.addColorStop(0, s.face[0]); g.addColorStop(0.38, s.face[1]); g.addColorStop(0.72, s.face[2]); g.addColorStop(1, s.face[3]);
  ctx.fillStyle = g; ctx.fill();
  sheen(ctx, x, y, Fr, s.sheen, 0);
  EMBLEMS[key](ctx, x, y, Fr, s.ink);
}

const _uris = new Map();

export function resourceTokenURI(key, size = 64) {
  const id = key + ':' + size;
  if (_uris.has(id)) return _uris.get(id);
  if (!RESOURCE_TOKENS.includes(key)) return null;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const malice = key === 'malice';
  const r = (size / 2) * (malice ? 0.84 : 0.96);
  drawResourceToken(ctx, key, size / 2, size / 2 + (malice ? size * 0.05 : 0), r);
  const uri = canvas.toDataURL('image/png');
  _uris.set(id, uri);
  return uri;
}

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));

export function resourceTokenHTML(key, { tooltip = '', className = '' } = {}) {
  const uri = resourceTokenURI(key);
  if (!uri) return '';
  const tip = tooltip ? ` data-tooltip="${esc(tooltip)}"` : '';
  return `<img class="ctlib-res-token ctlib-res-${esc(key)} ${esc(className)}" src="${uri}" alt=""${tip}>`;
}
