import { SceneGrid, SceneTerrain, wallHeight, coverWallHeight, solidTerrainRegions } from './terrain.mjs';
import { loeCornerInsets, wrapMethod } from './helpers.mjs';
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

config.define('wallHeightMovement', true);
config.define('range3d', true);

config.define('flanking3d', true);

const spaceOf = (token) => {
  const doc = token.document ?? token;
  const size = canvas.grid.size;
  const col = tokenColumn(doc);
  return { x: doc.x, y: doc.y, z: col.z * size, w: (doc.width ?? 1) * size, h: (doc.height ?? 1) * size, d: col.d * size };
};

export function adjacent3d(a, b) {
  const p = spaceOf(a);
  const q = spaceOf(b);
  const gap = (p0, ps, q0, qs) => Math.max(q0 - (p0 + ps), p0 - (q0 + qs));
  const gx = gap(p.x, p.w, q.x, q.w);
  const gy = gap(p.y, p.h, q.y, q.h);
  const gz = gap(p.z, p.d, q.z, q.d);
  const touching = Math.max(gx, gy, gz) <= EPS;
  const overlapping = gx < -EPS && gy < -EPS && gz < -EPS;
  return touching && !overlapping;
}

export function opposite3d(a, target, b) {
  const centre = (s) => [s.x + s.w / 2, s.y + s.h / 2, s.z + s.d / 2];
  const p0 = centre(spaceOf(a));
  const p1 = centre(spaceOf(b));
  const t = spaceOf(target);
  const lo = [t.x, t.y, t.z];
  const hi = [t.x + t.w, t.y + t.h, t.z + t.d];
  const hits = (axis, plane) => {
    const delta = p1[axis] - p0[axis];
    if (Math.abs(delta) < EPS) return false;
    const k = (plane - p0[axis]) / delta;
    if (k < -EPS || k > 1 + EPS) return false;
    for (let other = 0; other < 3; other++) {
      if (other === axis) continue;
      const v = p0[other] + (p1[other] - p0[other]) * k;
      if (v < lo[other] - EPS || v > hi[other] + EPS) return false;
    }
    return true;
  };
  return [0, 1, 2].some((axis) => hits(axis, lo[axis]) && hits(axis, hi[axis]));
}

export function registerFlanking3d() {
  const proto = CONFIG.Token.objectClass?.prototype;
  if (typeof proto?.isAdjacentTo !== 'function' || typeof proto?.onOppositeSideOrCorner !== 'function') return;
  const on = () => config.get('flanking3d') !== false && lineOfEffect3dOn();
  wrapMethod('CONFIG.Token.objectClass.prototype.isAdjacentTo', function (wrapped, target) {
    return on() ? adjacent3d(this, target) : wrapped(target);
  }, 'MIXED');
  wrapMethod('CONFIG.Token.objectClass.prototype.onOppositeSideOrCorner', function (wrapped, target, ally) {
    return on() ? opposite3d(this, target, ally) : wrapped(target, ally);
  }, 'MIXED');
}

export function registerWallHeightMovement() {
  if (typeof CONFIG.Canvas?.polygonBackends?.move?.prototype?._testEdgeInclusion !== 'function') return;
  wrapMethod('CONFIG.Canvas.polygonBackends.move.prototype._testEdgeInclusion', function (wrapped, edge, edgeTypes) {
    if (!wrapped(edge, edgeTypes)) return false;
    if (this.config?.type !== 'move' || config.get('wallHeightMovement') === false) return true;
    const wall = edge.object?.documentName === 'Wall' ? edge.object : (edge.object?.document?.documentName === 'Wall' ? edge.object.document : null);
    const token = this.config.source?.object?.document;
    const elevation = this.origin?.elevation;
    if (!wall || !token || !Number.isFinite(elevation)) return true;
    const info = sceneInfo(wall.parent ?? canvas.scene);
    const { bottom, top } = heightOf(info, wall);
    if (bottom === -Infinity && top === Infinity) return true;
    const unit = info.grid.unit;
    const feet = (elevation - ((token.depth ?? 1) * unit) / 2) / unit;
    const { d } = tokenColumn(token);
    return feet < top - EPS && feet + d > bottom + EPS;
  });
}

export function tokenColumn(token) {
  const doc = token?.document ?? token;
  const info = sceneInfo(doc.parent ?? canvas.scene);
  const z = info.grid.toSquares(doc.elevation ?? 0);
  const size = Number(doc.actor?.system?.combat?.size?.value) || 0;
  const d = Math.max(1, size, Number(doc.depth) > 1 ? Number(doc.depth) : 1);
  const level = doc.level ?? null;
  const { inset, back, probe } = loeCornerInsets();
  const ends = [[z + inset * d, z + back * d, -probe], [z + d - inset * d, z + d - back * d, probe]];
  const heights = ends.map(([h, pulled, step]) => (inset <= 0 && columnBlocked(info, doc, z + d / 2, h + step, level) ? pulled : h));
  return { z, d, heights, level };
}

function columnBlocked(info, doc, from, to, level) {
  const size = info.grid.size;
  const w = Math.max(1, Math.round(doc.width ?? 1));
  const h = Math.max(1, Math.round(doc.height ?? 1));
  info.terrain ??= new SceneTerrain({ scene: info.scene });
  for (let dx = 0; dx < w; dx++) {
    for (let dy = 0; dy < h; dy++) {
      const cell = { x: Math.round(doc.x / size) + dx, y: Math.round(doc.y / size) + dy };
      if (info.terrain.slabsAt(cell).some((s) => !s.liquid && to > s.bottom - EPS && to < s.top + EPS && !(s.surface && s.top === s.bottom))) return true;
      const c = info.grid.center(cell);
      if (surfacesHit(info, c, c, from, to, level) !== null) return true;
    }
  }
  return false;
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

function wallsHit(info, hits, za, zb) {
  let free = true;
  for (const h of hits) {
    if (h.wall) {
      const { bottom, top } = heightOf(info, h.wall);
      const z = za + (zb - za) * h.t;
      if (!(z > bottom + EPS && z < top - EPS)) continue;
    }
    if (h.limited && free) { free = false; continue; }
    return h.t;
  }
  return null;
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

function surfacesHit(info, a, b, za, zb, level) {
  if (za === zb || !hasSurfaces(info, level)) return null;
  const unit = info.grid.unit;
  try {
    const hit = info.scene.testSurfaceCollision({ x: a.x, y: a.y, elevation: za * unit }, { x: b.x, y: b.y, elevation: zb * unit }, { type: 'sight', mode: 'closest', level: level ?? undefined });
    return hit ? Math.min(1, Math.max(0, (hit.elevation / unit - za) / (zb - za))) : null;
  } catch {
    return null;
  }
}

function solidsHit(info, a, b, za, zb) {
  if (!info.solids.length) return null;
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const steps = Math.max(2, Math.ceil(len / (info.grid.size / 4)));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    const p = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    const z = za + (zb - za) * t;
    for (const s of info.solids) {
      if (!(z > s.bottom + EPS && z < s.top - EPS)) continue;
      if (s.region.polygonTree?.testPoint(p)) return t;
    }
  }
  return null;
}

export const lineHits = (a, b) => crossings(a, b);

export function firstBlock3d(a, b, za, zb, { level = null, hits = null } = {}) {
  const info = sceneInfo(canvas.scene);
  const found = [wallsHit(info, hits ?? crossings(a, b), za, zb), surfacesHit(info, a, b, za, zb, level), solidsHit(info, a, b, za, zb)].filter((t) => t !== null);
  return found.length ? Math.min(...found) : null;
}

export function coverWallHit3d(a, b, za, zb, walls) {
  const info = sceneInfo(canvas.scene);
  let first = null;
  for (const w of walls ?? []) {
    const doc = w.document ?? w;
    const [x0, y0, x1, y1] = doc.c;
    const x = foundry.utils.lineSegmentIntersection(a, b, { x: x0, y: y0 }, { x: x1, y: y1 });
    if (!x || x.t0 <= 0 || x.t0 > 1) continue;
    let h = info.heights.get(`cover:${doc.id}`);
    if (!h) {
      h = coverWallHeight(doc, info.grid);
      info.heights.set(`cover:${doc.id}`, h);
    }
    const z = za + (zb - za) * x.t0;
    if (!(z > h.bottom + EPS && z < h.top - EPS)) continue;
    if (first === null || x.t0 < first) first = x.t0;
  }
  return first;
}

export function lineBlocked3d(a, b, from, to) {
  const info = sceneInfo(canvas.scene);
  const hits = crossings(a, b);
  for (const za of from.heights) {
    for (const zb of to.heights) {
      if (wallsHit(info, hits, za, zb) !== null) continue;
      if (surfacesHit(info, a, b, za, zb, from.level) !== null) continue;
      if (solidsHit(info, a, b, za, zb) !== null) continue;
      return false;
    }
  }
  return true;
}

export function segmentBlocked3d(a, b) {
  const unit = sceneInfo(canvas.scene).grid.unit;
  return firstBlock3d(a, b, (a.elevation ?? 0) / unit, (b.elevation ?? 0) / unit, { level: a.level ?? null }) !== null;
}

export function segmentHit3d(a, b) {
  const unit = sceneInfo(canvas.scene).grid.unit;
  return firstBlock3d(a, b, (a.elevation ?? 0) / unit, (b.elevation ?? 0) / unit, { level: a.level ?? null });
}
