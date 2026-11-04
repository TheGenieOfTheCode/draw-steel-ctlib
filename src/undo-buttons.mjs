import { journal, undoJournalEntry } from './journal.mjs';
import { executeAsDirector, primaryGM } from './primary-director.mjs';
import { getSocket } from './socket.mjs';

const MODULE_ID = 'draw-steel-ctlib';
const ACTIONS = ['applyDamage', 'applyEffect', 'gainResource'];
const SELECTOR = ACTIONS.map((a) => `button[data-action="${a}"]`).join(', ');
const L = (key) => game.i18n.localize(`CTLIB.apply.${key}`);

const playerApply = () => {
  try { return game.settings.get(MODULE_ID, 'playerApply'); } catch { return true; }
};

function liveEntry(message, partId, button) {
  const action = button.dataset.action;
  const index = button.dataset.index != null ? Number(button.dataset.index) : null;
  return journal(message).filter((e) => e.partId === partId && e.action === action && !e.undone
    && (action !== 'applyDamage' || e.index == null || index == null || e.index === index)
    && (action !== 'applyEffect' || !e.effect || e.effect === button.dataset.effectId)).at(-1) ?? null;
}

const mayUndo = (message, entry, userId = game.user.id) => {
  const user = game.users.get(userId);
  if (!entry || !user) return false;
  if (user.isGM) return true;
  return playerApply() && (entry.userId === userId || message.author?.id === userId);
};

export async function undoEntryAsDirector(messageId, entryId, userId) {
  const message = game.messages.get(messageId);
  const entry = message?.flags?.[MODULE_ID]?.journal?.[entryId];
  if (!mayUndo(message, entry, userId)) return false;
  return undoJournalEntry(message, entryId);
}

async function undo(message, entry) {
  if (game.user.isGM) return undoJournalEntry(message, entry.id);
  if (!primaryGM()) return void ui.notifications.warn(L('noDirector'));
  return executeAsDirector(getSocket(), 'ctlib.undoJournalEntry', message.id, entry.id, game.user.id);
}

function splitButton(message, partId, button) {
  if (button.parentElement?.classList.contains('ctlib-split')) return;
  const entry = liveEntry(message, partId, button);
  const wrap = document.createElement('span');
  wrap.className = 'ctlib-split';
  button.before(wrap);
  wrap.append(button);
  if (entry) {
    button.classList.add('ctlib-applied');
    wrap.classList.add('ctlib-split-applied');
  }
  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'ctlib-undo';
  back.innerHTML = '<i class="fa-solid fa-rotate-left" inert></i>';
  back.setAttribute('aria-label', L('undo'));
  back.dataset.tooltip = L(entry ? 'undoHint' : 'undoNothing');
  const off = !mayUndo(message, entry);
  back.classList.toggle('ctlib-undo-off', off);
  back.setAttribute('aria-disabled', String(off));
  back.addEventListener('click', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (back.classList.contains('ctlib-undo-off')) return;
    const fresh = game.messages.get(message.id);
    const current = fresh && liveEntry(fresh, partId, button);
    if (!current) return;
    back.classList.add('ctlib-undo-off');
    await undo(fresh, current);
  });
  wrap.append(back);
}

export function registerUndoButtons() {
  Hooks.on('renderChatMessageHTML', (message, html) => {
    const parts = Array.from(message.system?.parts?.contents ?? []).filter((p) => p.type === 'targetResult');
    for (const part of parts) {
      const section = html.querySelector(`section[data-message-part="${part.id}"]`);
      for (const button of section?.querySelectorAll(SELECTOR) ?? []) splitButton(message, part.id, button);
    }
  });
}
