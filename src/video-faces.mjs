const PREFIXES = ['ctlib-', 'dsbl-', 'dsct-', 'dst-', 'dsdt-'];
const VIDEO = 'data-ctlib-video';
const SIZE = 200;
const COPIED = ['display', 'margin', 'verticalAlign', 'border', 'borderRadius', 'boxSizing', 'objectFit', 'objectPosition', 'opacity', 'filter', 'flex', 'alignSelf'];

const thumbs = new Map();
const bound = new WeakSet();
const playing = new WeakMap();
let swapped = false;

const isVideo = (src) => !!src && foundry.helpers.media.VideoHelper.hasVideoExtension(src);

const ours = (el) => {
  const { body, documentElement } = el.ownerDocument;
  for (let node = el; node?.nodeType === 1 && node !== body && node !== documentElement; node = node.parentElement) {
    if (node.id && PREFIXES.some((p) => node.id.startsWith(p))) return true;
    for (const cls of node.classList) if (PREFIXES.some((p) => cls.startsWith(p))) return true;
  }
  return false;
};

const thumbFor = (src) => {
  if (!thumbs.has(src)) thumbs.set(src, game.video.createThumbnail(src, { width: SIZE, height: SIZE }).catch(() => null));
  return thumbs.get(src);
};

async function showFirstFrame(img) {
  const src = img.getAttribute('src');
  if (!isVideo(src) || !ours(img)) return;
  img.setAttribute(VIDEO, src);
  const thumb = await thumbFor(src);
  if (thumb && img.getAttribute('src') === src) {
    img.src = thumb;
    swapped = true;
  }
}

const under = (el, x, y) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
};

function stop(doc) {
  const now = playing.get(doc);
  if (!now) return;
  playing.delete(doc);
  now.video.remove();
  now.img.style.display = now.display;
}

function onPointerMove(event) {
  if (!swapped) return;
  const target = event.target;
  const doc = target?.ownerDocument ?? document;
  const { clientX: x, clientY: y } = event;
  const now = playing.get(doc);
  if (now) {
    if (now.video.isConnected && under(now.video, x, y)) return;
    stop(doc);
  }
  const faces = target?.matches?.(`img[${VIDEO}]`) ? [target] : [...(target?.querySelectorAll?.(`img[${VIDEO}]`) ?? [])];
  const img = faces.find((f) => !isVideo(f.getAttribute('src')) && under(f, x, y));
  if (img) play(img);
}

function play(img) {
  const doc = img.ownerDocument;
  const video = doc.createElement('video');
  for (const { name, value } of img.attributes) if (name !== 'src' && name !== 'alt') video.setAttribute(name, value);
  const style = doc.defaultView.getComputedStyle(img);
  for (const key of COPIED) video.style[key] = style[key];
  Object.assign(video.style, { width: `${img.offsetWidth}px`, height: `${img.offsetHeight}px`, boxSizing: 'border-box' });
  if (style.objectFit === 'fill') video.style.objectFit = 'cover';
  Object.assign(video, { muted: true, defaultMuted: true, loop: true, autoplay: true, playsInline: true, poster: img.src });
  video.src = img.getAttribute(VIDEO);
  playing.set(doc, { img, video, display: img.style.display });
  img.style.display = 'none';
  img.after(video);
  video.play?.().catch(() => {});
}

export function bindVideoFaces(doc) {
  if (!doc || bound.has(doc)) return;
  bound.add(doc);
  doc.addEventListener('error', (event) => { if (event.target?.tagName === 'IMG') showFirstFrame(event.target); }, true);
  doc.addEventListener('pointermove', onPointerMove, { capture: true, passive: true });
  doc.addEventListener('pointerout', (event) => { if (!event.relatedTarget) stop(doc); }, true);
  for (const img of doc.images ?? []) if (img.complete && !img.naturalWidth) showFirstFrame(img);
}

export function registerVideoFaces() {
  bindVideoFaces(document);
  Hooks.once('ready', () => { for (const img of document.images) if (img.complete && !img.naturalWidth) showFirstFrame(img); });
  Hooks.on('openDetachedWindow', (_id, win) => bindVideoFaces(win.document));
}
