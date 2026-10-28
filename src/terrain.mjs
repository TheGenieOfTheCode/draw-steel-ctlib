import { getTags, getAllMaterials, getWallBlockBottom, getWallBlockTop, isOpenDoorWall, tileIsOpenDoor } from './helpers.mjs';

const MODULE_ID = 'draw-steel-ctlib';

export const TERRAIN_BEHAVIOR = `${MODULE_ID}.terrain`;

export class SceneGrid {
  constructor(scene = canvas.scene) {
    this.scene = scene;
    this.size = scene.grid.size;
    this.unit = scene.grid.distance || 1;
  }

  cellOf(point) {
    return { x: Math.floor(point.x / this.size), y: Math.floor(point.y / this.size) };
  }

  center(cell) {
    return { x: (cell.x + 0.5) * this.size, y: (cell.y + 0.5) * this.size };
  }

  topLeft(cell) {
    return { x: cell.x * this.size, y: cell.y * this.size };
  }

  toSquares(elevation) {
    return elevation == null ? null : elevation / this.unit;
  }

  toElevation(z) {
    return z * this.unit;
  }
}

const finite = (v, fallback) => (v === null || v === undefined || v === '' || !Number.isFinite(Number(v)) ? fallback : Number(v));

export function wallHeight(wall, grid = new SceneGrid(wall.parent)) {
  const standard = wall.flags?.['wall-height'];
  if (standard && (standard.bottom != null || standard.top != null)) {
    return { bottom: finite(standard.bottom, -Infinity) / grid.unit, top: finite(standard.top, Infinity) / grid.unit };
  }
  const own = wall.flags?.[MODULE_ID]?.height;
  if (own && (own.bottom != null || own.top != null)) return { bottom: finite(own.bottom, -Infinity), top: finite(own.top, Infinity) };
  const levels = wall.levels?.size ? [...wall.levels].map((id) => grid.scene.levels.get(id)).filter(Boolean) : [];
  if (!levels.length) return { bottom: -Infinity, top: Infinity };
  let bottom = Infinity;
  let top = -Infinity;
  for (const l of levels) {
    bottom = Math.min(bottom, finite(l.elevation.bottom, -Infinity));
    top = Math.max(top, finite(l.elevation.top, Infinity));
  }
  return { bottom: grid.toSquares(bottom), top: grid.toSquares(top) };
}

export const LOW_COVER_DROP = 0.5;

export function coverWallHeight(wall, grid = new SceneGrid(wall.parent)) {
  const { bottom, top } = wallHeight(wall, grid);
  const base = Number.isFinite(bottom) ? bottom : finite(grid.scene.getFlag?.(MODULE_ID, 'ground'), 0);
  return { bottom: base, top: (Number.isFinite(top) ? top : base + 1) - LOW_COVER_DROP };
}

export function tagsOf(doc) {
  const d = doc?.document ?? doc;
  const out = new Set();
  try { for (const t of getTags(d) ?? []) out.add(t); } catch { }
  for (const scope of [MODULE_ID, 'draw-steel-combat-tools', 'tagger']) for (const t of d?.flags?.[scope]?.tags ?? []) out.add(t);
  return out;
}

export function materialOf(tags) {
  let names = ['glass', 'wood', 'stone', 'metal'];
  try { names = getAllMaterials(); } catch { }
  return names.find((m) => tags.has(m)) ?? 'wood';
}

function blocksMovement(wall) {
  if (wall.move === CONST.WALL_MOVEMENT_TYPES.NONE) return false;
  return !isOpenDoorWall(wall);
}

function wallMaterial(wall) {
  const tags = tagsOf(wall);
  if (!tags.has('obstacle') || !tags.has('breakable') || tags.has('broken')) return null;
  return materialOf(tags);
}

function segmentsCross(ax, ay, bx, by, cx, cy, dx, dy) {
  const cross = (ox, oy, px, py, qx, qy) => (px - ox) * (qy - oy) - (py - oy) * (qx - ox);
  const d1 = cross(cx, cy, dx, dy, ax, ay);
  const d2 = cross(cx, cy, dx, dy, bx, by);
  const d3 = cross(ax, ay, bx, by, cx, cy);
  const d4 = cross(ax, ay, bx, by, dx, dy);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}

export class SceneTerrain {
  constructor({ scene = canvas.scene } = {}) {
    this.scene = scene;
    this.grid = new SceneGrid(scene);
    this.ground = finite(scene.getFlag?.(MODULE_ID, 'ground'), 0);
    this.#indexWalls();
  }

  #wallIndex = new Map();
  #slabCache = new Map();

  #indexWalls() {
    const g = this.grid;
    for (const wall of this.scene.walls) {
      if (!blocksMovement(wall)) continue;
      const [x0, y0, x1, y1] = wall.c;
      const entry = { wall, ...wallHeight(wall, g), material: wallMaterial(wall) };
      const cx0 = Math.floor(Math.min(x0, x1) / g.size) - 1;
      const cx1 = Math.floor(Math.max(x0, x1) / g.size) + 1;
      const cy0 = Math.floor(Math.min(y0, y1) / g.size) - 1;
      const cy1 = Math.floor(Math.max(y0, y1) / g.size) + 1;
      if ((cx1 - cx0) * (cy1 - cy0) > 40000) continue;
      for (let x = cx0; x <= cx1; x++) {
        for (let y = cy0; y <= cy1; y++) {
          const k = `${x},${y}`;
          const list = this.#wallIndex.get(k) ?? [];
          list.push(entry);
          this.#wallIndex.set(k, list);
        }
      }
    }
  }

  wallsBetween(from, to, zMin, zMax) {
    const a = this.grid.center(from);
    const b = this.grid.center(to);
    const out = [];
    for (const e of this.#wallIndex.get(`${from.x},${from.y}`) ?? []) {
      if (!(e.bottom < zMax && zMin < e.top)) continue;
      const [x0, y0, x1, y1] = e.wall.c;
      if (!segmentsCross(a.x, a.y, b.x, b.y, x0, y0, x1, y1)) continue;
      out.push({ id: e.wall.id, kind: 'wall', material: e.material, bottom: e.bottom, top: e.top, wall: e.wall.uuid });
    }
    return out;
  }

  slabsAt(cell) {
    const k = `${cell.x},${cell.y}`;
    let slabs = this.#slabCache.get(k);
    if (!slabs) {
      slabs = this.#readSlabs(cell);
      this.#slabCache.set(k, slabs);
    }
    return slabs;
  }

  #readSlabs(cell) {
    const g = this.grid;
    const c = g.center(cell);
    const out = [];
    let ground = { id: 'ground', bottom: -Infinity, top: this.ground, material: null, label: 'ground' };
    for (const region of this.scene.regions) {
      const behaviors = region.behaviors.filter((b) => !b.disabled && (b.type === 'defineSurface' || b.type === TERRAIN_BEHAVIOR));
      if (!behaviors.length) continue;
      if (!region.polygonTree?.testPoint(c)) continue;
      const bottom = finite(g.toSquares(region.elevation.bottom), -Infinity);
      const top = finite(g.toSquares(region.elevation.top), Infinity);
      const material = region.flags?.[MODULE_ID]?.material ?? null;
      for (const b of behaviors) {
        if (b.type === TERRAIN_BEHAVIOR) {
          const kind = b.system.kind;
          const mat = b.system.material || null;
          if (kind === 'liquid') out.push({ id: `${region.id}:liquid`, bottom, top, liquid: true, label: region.name, region: region.uuid });
          else if (kind === 'pit') ground = { ...ground, id: `${region.id}:pit`, top: Number.isFinite(bottom) ? bottom : -Infinity, label: region.name, region: region.uuid };
          else if (bottom === -Infinity) ground = { id: `${region.id}:ground`, bottom: -Infinity, top, material: mat, label: region.name, region: region.uuid };
          else out.push({ id: `${region.id}:solid`, bottom, top, material: mat, label: region.name, region: region.uuid });
          continue;
        }
        if (!b.system.move) continue;
        const flat = bottom === top;
        const place = b.system.placement;
        if ((place === 'bottom' || place === 'both' || flat) && Number.isFinite(bottom)) {
          out.push({ id: `${region.id}:${bottom}`, bottom, top: bottom, material, label: region.name, region: region.uuid, surface: true });
        }
        if (!flat && (place === 'top' || place === 'both') && Number.isFinite(top)) {
          out.push({ id: `${region.id}:${top}`, bottom: top, top, material, label: region.name, region: region.uuid, surface: true });
        }
      }
    }
    for (const tile of this.scene.tiles) {
      const tags = tagsOf(tile);
      if (!tags.has('obstacle') || tags.has('broken')) continue;
      const tc = g.cellOf(tile);
      if (tc.x !== cell.x || tc.y !== cell.y) continue;
      if (tileIsOpenDoor(tile)) continue;
      const bottom = finite(getWallBlockBottom(tile), null);
      const top = finite(getWallBlockTop(tile), null);
      const breakable = tags.has('breakable');
      out.push({
        id: `tile:${tile.id}`,
        bottom: bottom === null ? -Infinity : bottom / g.unit,
        top: top === null ? Infinity : top / g.unit,
        material: breakable ? materialOf(tags) : null,
        tile: tile.uuid,
        label: materialOf(tags),
      });
    }
    if (ground.top !== -Infinity) out.push(ground);
    return out.sort((a, b) => a.bottom - b.bottom);
  }
}

export function solidTerrainRegions(scene = canvas.scene) {
  const grid = new SceneGrid(scene);
  const out = [];
  for (const region of scene?.regions ?? []) {
    for (const b of region.behaviors) {
      if (b.disabled || b.type !== TERRAIN_BEHAVIOR || b.system.kind !== 'solid') continue;
      out.push({ region, bottom: finite(grid.toSquares(region.elevation.bottom), -Infinity), top: finite(grid.toSquares(region.elevation.top), Infinity) });
      break;
    }
  }
  return out;
}

export class TerrainBehavior extends foundry.data.regionBehaviors.RegionBehaviorType {
  static LOCALIZATION_PREFIXES = ['CTLIB.terrain'];

  static defineSchema() {
    const { StringField } = foundry.data.fields;
    return {
      kind: new StringField({ required: true, initial: 'solid', choices: { solid: 'CTLIB.terrain.kind.solid', liquid: 'CTLIB.terrain.kind.liquid', pit: 'CTLIB.terrain.kind.pit' } }),
      material: new StringField({ required: true, blank: true, initial: 'stone', choices: () => materialChoices() }),
    };
  }
}

function materialChoices() {
  const out = { '': 'CTLIB.terrain.material.solid' };
  let names = ['glass', 'wood', 'stone', 'metal'];
  try { names = getAllMaterials(); } catch { }
  for (const n of names) out[n] = game.i18n.has(`CTLIB.terrain.material.${n}`) ? `CTLIB.terrain.material.${n}` : n;
  return out;
}

export function registerTerrainBehavior() {
  CONFIG.RegionBehavior.dataModels[TERRAIN_BEHAVIOR] = TerrainBehavior;
  CONFIG.RegionBehavior.typeIcons[TERRAIN_BEHAVIOR] = 'fa-solid fa-mountain';
  CONFIG.RegionBehavior.typeLabels[TERRAIN_BEHAVIOR] = 'CTLIB.terrain.label';
}
