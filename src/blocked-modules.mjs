

const MODULE_ID = 'draw-steel-ctlib';
const FLAG = 'seenBlocked';

const L = (key, data) => (data ? game.i18n.format(`CTLIB.notice.blocked.${key}`, data) : game.i18n.localize(`CTLIB.notice.blocked.${key}`));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ''));
const short = (title) => String(title ?? '').replace(/^Draw Steel:\s*/, '');

function problemsOf(mod) {
  const problems = [];
  for (const req of mod.relationships?.requires ?? []) {
    if (req.type && req.type !== 'module') continue;
    const dep = game.modules.get(req.id);
    const min = req.compatibility?.minimum;
    if (!dep) problems.push({ id: req.id, kind: 'missing' });
    else if (min && foundry.utils.isNewerVersion(min, dep.version)) problems.push({ id: req.id, kind: 'old', min, have: dep.version, title: dep.title });
  }
  return problems;
}

export function blockedModules() {
  const blocked = [];
  for (const mod of game.modules) {
    if (mod.id === MODULE_ID) continue;
    const reqs = [...(mod.relationships?.requires ?? [])];
    if (!reqs.some((r) => r.id === MODULE_ID)) continue;
    const problems = problemsOf(mod);
    if (problems.length) blocked.push({ mod, problems });
  }
  return blocked;
}

const keyOf = ({ mod, problems }) => `${mod.id}@${mod.version}:${problems.map((p) => `${p.id}${p.kind === 'old' ? `<${p.min}@${p.have}` : '?'}`).join(',')}`;

const lineOf = (p) => (p.kind === 'missing'
  ? L('missing', { module: p.id })
  : L('old', { module: short(p.title), min: p.min, have: p.have }));

function html(blocked) {
  const names = new Intl.ListFormat(game.i18n.lang, { type: 'conjunction' }).format(blocked.map((b) => short(b.mod.title)));
  const items = blocked.map(({ mod, problems }) => `<li><strong>${esc(L('cannot', { module: short(mod.title), version: mod.version }))}</strong>`
    + `<ul>${problems.map((p) => `<li>${esc(lineOf(p))}</li>`).join('')}</ul></li>`).join('');
  return `<div class="ctlib-notice">
    <p class="ctlib-notice-head"><i class="fa-solid fa-plug-circle-exclamation" inert></i> ${esc(L('title'))}</p>
    <ul>${items}</ul>
    <p>${esc(L('fix', { modules: names }))}</p>
  </div>`;
}

export async function showBlocked() {
  if (!game.user.isGM) return;
  const seen = game.user.getFlag(MODULE_ID, FLAG) ?? [];
  const blocked = blockedModules();
  const fresh = blocked.filter((b) => !seen.includes(keyOf(b)));
  if (!fresh.length) return;
  await game.user.setFlag(MODULE_ID, FLAG, [...new Set([...seen, ...fresh.map(keyOf)])]);
  await ChatMessage.create({
    content: html(fresh),
    whisper: [game.user.id],
    speaker: { alias: game.modules.get(MODULE_ID)?.title ?? 'CTLib' },
    flags: { [MODULE_ID]: { notice: 'blocked' } },
  });
  const names = new Intl.ListFormat(game.i18n.lang, { type: 'conjunction' }).format(fresh.map((b) => short(b.mod.title)));
  ui.notifications.warn(L('toast', { modules: names }), { permanent: true });
}

Hooks.once('ready', () => setTimeout(() => showBlocked().catch((err) => console.warn('CTLib | blocked modules | could not post:', err)), 4000));
