const FACE = 'data-ctlib-face';

export function faceFromToken(tokenDoc, { faded = false, tooltip = null } = {}) {
  const doc = tokenDoc?.document ?? tokenDoc;
  if (!doc) return null;
  const combatant = game.combat?.combatants?.find((c) => c.tokenId === doc.id && c.sceneId === doc.parent?.id) ?? null;
  const group = combatant?.group ?? null;
  const squad = group?.type === 'squad' ? group : null;
  return {
    tokenUuid: doc.uuid,
    src: doc.texture?.src ?? doc.actor?.img ?? null,
    name: doc.name ?? doc.actor?.name ?? '',
    minion: !!doc.actor?.system?.isMinion,
    captain: !!squad && squad.system?.captainId === combatant.id,
    squadId: squad?.id ?? null,
    faded: !!faded,
    tooltip,
  };
}

export function groupFaces(faces) {
  const groups = [];
  const bySquad = new Map();
  for (const face of faces ?? []) {
    if (!face) continue;
    const key = face.minion && face.squadId ? `${face.squadId}|${face.name}` : null;
    if (key && bySquad.has(key)) { bySquad.get(key).faces.push(face); continue; }
    const group = { label: face.name, faces: [face] };
    groups.push(group);
    if (key) bySquad.set(key, group);
  }
  for (const group of groups) {
    group.faded = group.faces.every((f) => f.faded);
    group.faces.sort((a, b) => (a.faded - b.faded) || (b.captain - a.captain));
  }
  return groups;
}

const esc = (value) => foundry.utils.escapeHTML(String(value ?? ''));

export function faceChainHTML(faces, { className = '' } = {}) {
  const items = (faces ?? []).filter((f) => f?.src).map((f) => {
    const wrap = ['ctlib-face-wrap', f.captain ? 'ctlib-face-captain' : '', f.faded ? 'ctlib-face-faded' : ''].filter(Boolean).join(' ');
    const img = ['ctlib-face', f.minion && !f.captain ? 'ctlib-face-minion' : ''].filter(Boolean).join(' ');
    const mark = f.captain ? '<i class="fa-solid fa-helmet-battle ctlib-face-captain-mark" inert></i>' : '';
    return `<span class="${wrap}" ${FACE}="${esc(f.tokenUuid ?? '')}" data-ctlib-face-name="${esc(f.name)}" data-tooltip="${esc(f.tooltip ?? f.name)}"><img class="${img}" src="${esc(f.src)}" alt="">${mark}</span>`;
  });
  return `<span class="ctlib-faces ${esc(className)}">${items.join('')}</span>`;
}

const tokenOf = (el) => {
  const doc = fromUuidSync(el?.getAttribute(FACE) ?? '');
  return doc?.parent === canvas.scene ? doc.object : null;
};

export function activateFaces(root) {
  if (!root || root.dataset.ctlibFaces) return;
  root.dataset.ctlibFaces = '1';
  root.addEventListener('click', (event) => {
    const el = event.target.closest?.(`[${FACE}]`);
    if (!el || !root.contains(el)) return;
    event.stopPropagation();
    const token = tokenOf(el);
    if (!token) {
      const name = fromUuidSync(el.getAttribute(FACE))?.name ?? el.dataset.ctlibFaceName ?? '';
      ui.notifications.info(game.i18n.format('CTLIB.faces.notOnScene', { name }));
      return;
    }
    const pull = event.shiftKey;
    canvas.ping(token.center, pull ? { style: CONFIG.Canvas.pings.types.PULL, pull } : {});
  });
  root.addEventListener('pointerover', (event) => {
    const el = event.target.closest?.(`[${FACE}]`);
    if (!el || el.contains(event.relatedTarget)) return;
    const token = tokenOf(el);
    if (token?.visible && token._canHover?.(game.user, event) !== false) token._onHoverIn?.(event, { hoverOutOthers: true });
  });
  root.addEventListener('pointerout', (event) => {
    const el = event.target.closest?.(`[${FACE}]`);
    if (el && !el.contains(event.relatedTarget)) tokenOf(el)?._onHoverOut?.({});
  });
}
