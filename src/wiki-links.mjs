import { setTip, tipFrom } from './rich-tips.mjs';

export function wikiUrl(base, page) {
  if (!page) return null;
  return /^https?:/.test(page) ? page : `${String(base ?? '').replace(/\/?$/, '/')}${page}`;
}

export function wikiLink(url) {
  const a = document.createElement('a');
  a.className = 'ctlib-wiki-link';
  a.href = url;
  a.target = '_blank';
  a.rel = 'noopener';
  const page = decodeURIComponent(url.split('/').pop().split('#')[0]).replace(/-/g, ' ');
  a.setAttribute('aria-label', game.i18n.format('CTLIB.settings.wikiLink', { page }));
  setTip(a, tipFrom('CTLIB.tip.wiki', { data: { page } }));
  a.innerHTML = '<i class="fa-solid fa-books" inert></i>';
  return a;
}

export function addWikiLink(target, url) {
  if (!target || !url || target.querySelector(':scope > .ctlib-wiki-link')) return;
  target.append(wikiLink(url));
}
