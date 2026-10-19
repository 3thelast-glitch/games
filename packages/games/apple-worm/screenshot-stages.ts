import source from './screenshot-stages-105.json';

export type Cell = readonly [number, number];
export type SourceDirection = 'up' | 'right' | 'down' | 'left';
export interface SourceHazard {
  kind: 'saw' | 'spike';
  position: Cell;
  direction?: SourceDirection;
}
export interface ScreenshotStage {
  id: number;
  sourceImage: string;
  sourceSha256: string;
  width: number;
  height: number;
  sourceDimensions: Cell;
  gridOrigin: Cell;
  gridPitch: number;
  terrain: readonly Cell[];
  worm: readonly Cell[];
  wormHead: Cell;
  apples: readonly Cell[];
  portal: Cell | null;
  portalPixel: Cell | null;
  hazards: readonly SourceHazard[];
  movableObjects: readonly Cell[];
  terrainStyle: 'earth' | 'brick';
  sourceType: 'provided-screenshot';
  visualVerification: 'pending' | 'reviewed' | 'passed';
  gameplayVerification: 'pending' | 'solvable' | 'passed';
  unresolved: readonly string[];
  completionRule: 'portal' | 'collect-visible-apples';
  adaptation?: string;
  mechanicsPolicy: string;
}

// Each row has its own screenshot digest and geometry. No seed, template, or
// legacy map participates in this registry. Pending is deliberately not passed.
export const SCREENSHOT_STAGES = source as unknown as readonly ScreenshotStage[];
export const SCREENSHOT_STAGE_COUNT = 105;
export const SCREENSHOT_GROUPS = Array.from({ length: 7 }, (_, i) => ({
  start: i * 15 + 1, end: (i + 1) * 15,
}));
export function screenshotStage(id: number): ScreenshotStage {
  if (!Number.isInteger(id) || id < 1 || id > SCREENSHOT_STAGE_COUNT)
    throw new RangeError('Screenshot stage must be 1–105');
  return SCREENSHOT_STAGES[id - 1]!;
}
export const cellKey = ([x, y]: Cell) => `${x},${y}`;
export const sameCell = (a: Cell, b: Cell) => a[0] === b[0] && a[1] === b[1];

/** Structural checks are independent of solver outcomes and visual acceptance. */
export function validateScreenshotStage(s: ScreenshotStage): string[] {
  const issues: string[] = [];
  const all = [...s.terrain, ...s.worm, ...s.apples, ...s.movableObjects,
    ...s.hazards.map(h => h.position), ...(s.portal ? [s.portal] : [])];
  if (all.some(([x, y]) => !Number.isInteger(x) || !Number.isInteger(y) ||
      x < 0 || y < 0 || x >= s.width || y >= s.height)) issues.push('coordinate_out_of_bounds');
  if (s.worm.length < 2 || !sameCell(s.worm[0]!, s.wormHead)) issues.push('invalid_head');
  if (new Set(s.worm.map(cellKey)).size !== s.worm.length) issues.push('duplicate_worm_cell');
  if (s.worm.slice(1).some((p, i) => Math.abs(p[0]-s.worm[i]![0]) +
      Math.abs(p[1]-s.worm[i]![1]) !== 1)) issues.push('disconnected_worm');
  const occupied = new Set(s.terrain.map(cellKey));
  for (const [name, points] of [['worm', s.worm], ['apple', s.apples],
    ['box', s.movableObjects], ['hazard', s.hazards.map(h=>h.position)]] as const) {
    if (points.some(p => occupied.has(cellKey(p)))) issues.push(`${name}_terrain_overlap`);
    if (new Set(points.map(cellKey)).size !== points.length) issues.push(`duplicate_${name}`);
  }
  return issues;
}
