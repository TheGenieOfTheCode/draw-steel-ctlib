import { SceneGrid, wallHeight, solidTerrainRegions } from './terrain.mjs';
import * as config from './config.mjs';

config.define('lineOfEffect3d', true);

const EPS = 1e-4;
export const CORNER = 0.05;
let _info = null;

const sceneInfo = (scene) => {
  if (_info?.scene === scene) return _info;
  _info = { scene, grid: new SceneGrid(scene), solids: solidTerrainRegions(scene), heights: new Map(), surfaces: new Map() };
  return _info;
};

export const resetLineOfEffect3d = () => { _info = null; };

for (const hook of ['canvasReady', 'createWall', 'updateWall', 'deleteWall', 'createRegion', 'updateRegion', 'deleteRegion',
  'createRegionBehavior', 'updateRegionBehavior', 'deleteRegionBehavior', 'updateScene', 'createLevel', 'updateLevel', 'deleteLevel']) {
  Hooks.on(hook, resetLineOfEffect3d);
}

export const lineOfEffect3dOn = () => config.get('lineOfEffect3d') !== false && !!canvas?.scene;

export function tokenColumn(token) {
  const doc = token?.document ?? token;
  const grid = sceneInfo(doc.parent ?? canvas.scene).grid;
  const z = grid.toSquares(doc.elevation ?? 0);
  const size = Number(doc.actor?.system?.combat?.size?.value) || 0;
  const d = Math.max(1, size, Number(doc.depth) > 1 ? Number(doc.depth) : 1);
  return { z, d, heights: [z + CORNER, z + d - CORNER], level: doc.level ?? null };
}

function heightOf(info, wall) {
  let h = info.heights.get(wall.id);
  if (!h) {
    h = wallHeight(wall, info.grid);
    info.heights.set(wall.id, h);
  }
  return h;
}

function crossings(a, b) {
  const Backend = CONFIG.Canvas?.polygonBackends?.sight;
  if (!Backend) return [];
  const x0 = Math.round(a.x);
  const y0 = Math.round(a.y);
  const x1 = Math.round(b.x);
  const y1 = Math.round(b.y);
  if (x0 === x1 && y0 === y1) return [];
  const poly = new Backend();
  poly.initialize({ x: x0, y: y0 }, { type: 'sight', boundaryShapes: [new PIXI.Rectangle(x0, y0, x1 - x0, y1 - y0).normalize()] });
  poly._identifyEdges();
  const out = [];
  for (const edge of poly.edges) {
    const x = foundry.utils.lineSegmentIntersection({ x: x0, y: y0 }, { x: x1, y: y1 }, edge.a, edge.b);
    if (!x || x.t0 <= 0 || x.t0 > 1) continue;
    const obj = edge.object;
    const wall = obj?.documentName === 'Wall' ? obj : (obj?.document?.documentName === 'Wall' ? obj.document : null);
    if (wall && wall.blocksLineOfEffect === false) continue;
    out.push({ t: x.t0, wall, limited: edge.isLimited('sight') });
  }
  return out.sort((p, q) => p.t - q.t);
}

function wallsBlock(info, hits, za, zb) {
  let free = true;
  for (const h of hits) {
    if (h.wall) {
      const { bottom, top } = heightOf(info, h.wall);
      const z = za + (zb - za) * h.t;
      if (!(z > bottom + EPS && z < top - EPS)) continue;
    }
    if (h.limited && free) { free = false; continue; }
    return true;
  }
  return false;
}

function hasSurfaces(info, level) {
  const key = level ?? '';
  if (!info.surfaces.has(key)) {
    let any = false;
    try { any = (info.scene.getSurfaces?.({ type: 'sight', level: level ?? undefined }) ?? []).length > 0; } catch { any = false; }
    info.surfaces.set(key, any);
  }
  return info.surfaces.get(key);
}

function surfacesBlock(info, a, b, za, zb, level) {
  if (za === zb || !hasSurfaces(info, level)) return false;
  const unit = info.grid.unit;
  try {
    return !!info.scene.testSurfaceCollision({ x: a.x, y: a.y, elevation: za * unit }, { x: b.x, y: b.y, elevation: zb * unit }, { type: 'sight', mode: 'any', level: level ?? undefined });
  } catch {
    return false;
  }
}

function solidsBlock(info, a, b, za, zb) {
  if (!info.solids.length) return false;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(2, Math.ceil(len / (info.grid.size / 4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const z = za + (zb - za) * t;
    for (const s of info.solids) {
      if (!(z > s.bottom + EPS && z < s.top - EPS)) continue;
      if (s.region.polygonTree?.testPoint(p)) return true;
    }
  }
  return false;
}

export function lineBlocked3d(a, b, from, to) {
  const info = sceneInfo(canvas.scene);
  const hits = crossings(a, b);
  for (const za of from.heights) {
    for (const zb of to.heights) {
      if (wallsBlock(info, hits, za, zb)) continue;
      if (surfacesBlock(info, a, b, za, zb, from.level)) continue;
      if (solidsBlock(info, a, b, za, zb)) continue;
      return false;
    }
  }
  return true;
}

export function segmentBlocked3d(a, b) {
  const info = sceneInfo(canvas.scene);
  const unit = info.grid.unit;
  const za = (a.elevation ?? 0) / unit;
  const zb = (b.elevation ?? 0) / unit;
  return wallsBlock(info, crossings(a, b), za, zb) || surfacesBlock(info, a, b, za, zb, a.level ?? null) || solidsBlock(info, a, b, za, zb);
}
