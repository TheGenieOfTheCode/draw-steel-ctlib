const MODULE_ID = 'draw-steel-ctlib';
const DSTD = 'draw-steel-target-damage';
const NOTICE = 'targetDamageOn12';
const FLAG = 'keepTargetDamage';

const L = (key, data) => (data ? game.i18n.format(`CTLIB.notice.targetDamage.${key}`, data) : game.i18n.localize(`CTLIB.notice.targetDamage.${key}`));
const esc = (s) => foundry.utils.escapeHTML(String(s ?? ''));
const short = (title) => String(title ?? '').replace(/^Draw Steel:\s*/, '');

const onSystem12 = () => !!globalThis.ds?.CONFIG?.MessagePart?.targetResult;

const dependents = () => game.modules.filter((m) => m.active && m.id !== DSTD
  && (m.relationships?.requires ?? []).some((r) => r.id === DSTD));

function html() {
  return `<div class="ctlib-notice">
    <p class="ctlib-notice-head"><i class="fa-solid fa-triangle-exclamation" inert></i> ${esc(L('title'))}</p>
    <p>${esc(L('body'))}</p>
    <button type="button" data-ctlib-dstd-off><i class="fa-solid fa-power-off" inert></i> ${esc(L('turnOff'))}</button>
    <button type="button" data-ctlib-dstd-keep><i class="fa-solid fa-bell-slash" inert></i> ${esc(L('keep'))}</button>
  </div>`;
}

const oldNotices = () => game.messages.filter((m) => m.getFlag(MODULE_ID, 'notice') === NOTICE && m.isOwner);

export async function showTargetDamageNotice() {
  if (!game.user.isGM) return;
  const stale = oldNotices();
  if (stale.length) await ChatMessage.deleteDocuments(stale.map((m) => m.id));
  if (!onSystem12() || !game.modules.get(DSTD)?.active || game.user.getFlag(MODULE_ID, FLAG)) return;
  await ChatMessage.create({
    content: html(),
    whisper: [game.user.id],
    speaker: { alias: game.modules.get(MODULE_ID)?.title ?? 'CTLib' },
    flags: { [MODULE_ID]: { notice: NOTICE } },
  });
}

async function turnOff() {
  const needs = dependents();
  if (needs.length) {
    const names = new Intl.ListFormat(game.i18n.lang, { type: 'conjunction' }).format(needs.map((m) => short(m.title)));
    return void ui.notifications.warn(L('needed', { modules: names }));
  }
  const SettingsConfig = foundry.applications.settings.SettingsConfig;
  const SETTING = foundry.applications.sidebar.apps.ModuleManagement.SETTING;
  const config = { ...game.settings.get('core', SETTING), [DSTD]: false };
  SettingsConfig.reloadConfirm({ world: true });
  await game.settings.set('core', SETTING, config);
}

async function keepOn() {
  await game.user.setFlag(MODULE_ID, FLAG, true);
  const stale = oldNotices();
  if (stale.length) await ChatMessage.deleteDocuments(stale.map((m) => m.id));
  ui.notifications.info(L('kept'));
}

Hooks.once('ready', () => setTimeout(() => showTargetDamageNotice().catch((err) => console.warn('CTLib | Target Damage notice | could not post:', err)), 4000));

Hooks.on('renderChatMessageHTML', (message, html) => {
  if (message.getFlag(MODULE_ID, 'notice') !== NOTICE) return;
  const off = html.querySelector('[data-ctlib-dstd-off]');
  const keep = html.querySelector('[data-ctlib-dstd-keep]');
  if (!game.modules.get(DSTD)?.active) {
    off?.remove();
    keep?.remove();
    return;
  }
  off?.addEventListener('click', (event) => {
    event.preventDefault();
    turnOff().catch((err) => console.warn('CTLib | Target Damage notice | could not turn it off:', err));
  });
  keep?.addEventListener('click', (event) => {
    event.preventDefault();
    keepOn().catch((err) => console.warn('CTLib | Target Damage notice | could not save:', err));
  });
});
