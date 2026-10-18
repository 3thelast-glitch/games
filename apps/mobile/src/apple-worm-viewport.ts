/** Keep the gameplay scene proportional to the actual phone window.
 * Unlike a fixed 16:9 SVG, ultra-wide devices have no side gutters.
 * Scale world coordinates uniformly; never stretch the worm or crop terrain.
 */
export interface WormViewport {
  sceneWidth: number;
  sceneHeight: number;
  boardX: number;
  boardY: number;
}
export function fitWormViewport(
  columns: number, rows: number, viewportWidth: number, viewportHeight: number, tile = 48,
): WormViewport {
  const ratio = Number.isFinite(viewportWidth) && Number.isFinite(viewportHeight) &&
    viewportWidth > 0 && viewportHeight > 0 ? viewportWidth / viewportHeight : 16 / 9;
  const safeRatio = Math.max(.5, Math.min(4, ratio));
  const boardWidth = columns * tile;
  const boardHeight = rows * tile;
  // A wide scene keeps its interactive tiles large while making spare width
  // part of the original sky art; a narrow scene grows in virtual height.
  const sceneHeight = Math.max(boardHeight + tile * 3, (boardWidth + tile * 3) / safeRatio);
  const sceneWidth = sceneHeight * safeRatio;
  return {
    sceneWidth,
    sceneHeight,
    boardX: (sceneWidth - boardWidth) / 2,
    boardY: (sceneHeight - boardHeight) * .62,
  };
}
