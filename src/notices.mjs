import { openBugReport, reportableModules } from './bug-report.mjs';

const MODULE_ID = 'draw-steel-ctlib';
const FLAG = 'seenNotices';

const NOTICES = [
  {
    id: 'bug-report',
    since: '1.2.0',
    html: () => {
      const L = (key, data) => (data ? game.i18n.format(`CTLIB.notice.bugReport.${key}`, data) : game.i18n.localize(`CTLIB.notice.bugReport.${key}`));
      const names = reportableModules().filter((m) => m.id !== MODULE_ID).map((m) => m.title.replace(/^Draw Steel:\s*/, ''));
      const modules = names.length
        ? new Intl.ListFormat(game.i18n.lang, { type: 'disjunction' }).format(names)
        : game.i18n.localize('CTLIB.notice.bugReport.anyModule');
      const esc = foundry.utils.escapeHTML;
      return `<div class="ctlib-notice">
        <p class="ctlib-notice-head"><i class="fa-solid fa-bug" inert></i> ${esc(L('title'))}</p>
        <p>${esc(L('body', { modules }))}</p>
        <p>${esc(L('extra'))}</p>
        <button type="button" data-ctlib-open-bug-report><i class="fa-solid fa-bug" inert></i> ${esc(L('open'))}</button>
      </div>`;
    },
  },
];

export const showNotices = async () => {
  const version = game.modules.get(MODULE_ID)?.version ?? '0';
  const seen = game.user.getFlag(MODULE_ID, FLAG) ?? [];
  const fresh = NOTICES.filter((n) => !seen.includes(n.id) && !foundry.utils.isNewerVersion(n.since, version));
  if (!fresh.length) return;
  await game.user.setFlag(MODULE_ID, FLAG, [...seen, ...fresh.map((n) => n.id)]);
  for (const n of fresh) {
    await ChatMessage.create({
      content: n.html(),
      whisper: [game.user.id],
      speaker: { alias: game.modules.get(MODULE_ID)?.title ?? 'CTLib' },
      flags: { [MODULE_ID]: { notice: n.id } },
    });
  }
};

Hooks.once('ready', () => setTimeout(() => showNotices().catch((err) => console.warn('CTLib | notices | could not post:', err)), 4000));

Hooks.on('renderChatMessageHTML', (message, html) => {
  if (!message.getFlag(MODULE_ID, 'notice')) return;
  html.querySelector('[data-ctlib-open-bug-report]')?.addEventListener('click', (event) => {
    event.preventDefault();
    openBugReport();
  });
});
