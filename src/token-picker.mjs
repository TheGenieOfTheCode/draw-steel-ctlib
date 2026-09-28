import { beginPickerOverlay, setPickerArrow, removePickerArrow, clearPickerArrows } from './picker-overlay.mjs';
import { tokFootprintDist, hasSightToToken, burrowBlocksLineOfEffect } from './helpers.mjs';
import * as config from './config.mjs';
import * as services from './services.mjs';

const _defeatedStatus = () => CONFIG.specialStatusEffects?.DEFEATED ?? 'dead';
const _isDefeated     = (t) => t.actor?.statuses?.has(_defeatedStatus()) ?? false;
const _hasAnySightTo  = (casterToken, targetToken, shift = null) => hasSightToToken(casterToken, targetToken, { shift });

const isHiddenFrom = (token, observer) => services.get('isHiddenFrom')?.(token, observer) ?? false;

function _hitToken(pos, candidates) {
  const GS = canvas.grid.size;
  return candidates.find(t => {
    const tw = t.document.width  * GS;
    const th = t.document.height * GS;
    return pos.x >= t.x && pos.x <= t.x + tw && pos.y >= t.y && pos.y <= t.y + th;
  }) ?? null;
}

export function getValidTargets(casterToken, targetType, range, { excludeSelf = false, checkLOS = false, respectHidden = false, shift = null } = {}) {
  const CGD      = canvas.grid.distance;
  const hasRange = range > 0 && !isNaN(range);
  const cDisp    = casterToken.document.disposition;

  const inRange  = (t) => !hasRange || tokFootprintDist(casterToken, t) < range * CGD;
  const alive    = (t) => !_isDefeated(t) && !t.document.hidden;
  const dead     = (t) => _isDefeated(t);
  const sameDisp = (t) => t.document.disposition === cDisp;
  const isSelf   = (t) => t.id === casterToken.id;

  return canvas.tokens.placeables.filter(t => {
    if (!inRange(t)) return false;
    if (excludeSelf && isSelf(t)) return false;

    let valid;
    switch (targetType) {
      case 'creature':       valid = alive(t); break;
      case 'ally':           valid = !isSelf(t) && alive(t) && sameDisp(t); break;
      case 'enemy':          valid = !isSelf(t) && alive(t) && !sameDisp(t); break;
      case 'object':         valid = dead(t); break;
      case 'creatureObject': valid = alive(t) || dead(t); break;
      case 'enemyObject':    valid = (!isSelf(t) && alive(t) && !sameDisp(t)) || dead(t); break;
      case 'selfOrAlly':     valid = isSelf(t) || (alive(t) && sameDisp(t)); break;
      case 'selfOrCreature': valid = isSelf(t) || alive(t); break;
      case 'selfAlly':       valid = isSelf(t) || (alive(t) && sameDisp(t)); break;
      default:               valid = alive(t); break;
    }
    if (!valid) return false;

    
    if (checkLOS && !isSelf(t) && !_hasAnySightTo(casterToken, t, shift)) return false;
    if (!isSelf(t) && burrowBlocksLineOfEffect(casterToken, t)) return false;

    
    if (respectHidden && !isSelf(t) && isHiddenFrom(t, casterToken)) return false;
    return true;
  });
}

const _cssHexToNum = (css) => parseInt(css.slice(1), 16);

const _darkenHex = (hex) => {
  const r = Math.round(((hex >> 16) & 0xff) * 0.6);
  const g = Math.round(((hex >> 8)  & 0xff) * 0.6);
  const b = Math.round( (hex        & 0xff) * 0.6);
  return (r << 16) | (g << 8) | b;
};

const _brightenHex = (hex) => {
  const r = Math.min(255, ((hex >> 16) & 0xff) + 60);
  const g = Math.min(255, ((hex >> 8)  & 0xff) + 60);
  const b = Math.min(255,  (hex        & 0xff) + 60);
  return (r << 16) | (g << 8) | b;
};

export async function runColoredTokenPicker({ tokens, colorMap, hint }) {
  if (!tokens.length) return null;

  const hlName = 'dsct-colored-picker-hl';
  if (canvas.interface.grid.highlightLayers[hlName]) canvas.interface.grid.destroyHighlightLayer(hlName);
  canvas.interface.grid.addHighlightLayer(hlName);

  const GS = canvas.grid.size;
  const drawHighlights = (hoverId = null) => {
    canvas.interface.grid.clearHighlightLayer(hlName);
    for (const t of tokens) {
      const base   = _cssHexToNum(colorMap.get(t.id) ?? '#4488ff');
      const color  = t.id === hoverId ? _brightenHex(base) : base;
      const border = _darkenHex(base);
      const w = Math.max(1, Math.round(t.document.width));
      const h = Math.max(1, Math.round(t.document.height));
      for (let dx = 0; dx < w; dx++) {
        for (let dy = 0; dy < h; dy++) {
          canvas.interface.grid.highlightPosition(hlName, {
            x: Math.floor(t.x / GS) * GS + dx * GS,
            y: Math.floor(t.y / GS) * GS + dy * GS,
            color, border,
          });
        }
      }
    }
  };

  drawHighlights();

  return new Promise(resolve => {
    const overlay = beginPickerOverlay({
      title: game.i18n.localize('CTLIB.picker.titleSource'),
      status: hint ?? '',
      tokens,
      showConfirm: false,
      onCancel: () => { cleanup(); resolve(null); },
    });

    const cleanup = () => {
      overlay.end();
      canvas.interface.grid.destroyHighlightLayer(hlName);
      clearPickerArrows();
      canvas.stage.off('mousedown', onClick);
      canvas.stage.off('mousemove', onMove);
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('contextmenu', onContextMenu);
    };

    let hoverId = null;

    const onMove = (event) => {
      const pos    = event.data.getLocalPosition(canvas.app.stage);
      const hit    = _hitToken(pos, tokens);
      const newId  = hit?.id ?? null;
      if (newId === hoverId) return;
      if (hoverId) removePickerArrow(canvas.tokens.get(hoverId));
      hoverId = newId;
      if (hit) setPickerArrow(hit, _cssHexToNum(colorMap.get(hit.id) ?? '#ffffff'));
      drawHighlights(hoverId);
    };

    const onClick = (event) => {
      if (event.data.originalEvent.button === 2) {
        if (config.get('cancelOnRightClick')) { cleanup(); resolve(null); }
        return;
      }
      if (event.data.originalEvent.button !== 0) return;
      const hit = _hitToken(event.data.getLocalPosition(canvas.app.stage), tokens);
      if (!hit) return;
      cleanup();
      resolve(hit);
    };

    const onKey           = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cleanup(); resolve(null); } };
    const onContextMenu   = (e) => { e.preventDefault(); if (config.get('cancelOnRightClick')) { cleanup(); resolve(null); } };

    canvas.stage.on('mousedown', onClick);
    canvas.stage.on('mousemove', onMove);
    document.addEventListener('keydown', onKey);
    document.addEventListener('contextmenu', onContextMenu);
  });
}
