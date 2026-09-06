import { expect, type Locator, type Page } from '@playwright/test';

export type Box = { x: number; y: number; width: number; height: number };

const tolerance = 2;

export async function expectNoGlobalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    bodyWidth: document.body.scrollWidth,
  }));
  expect(
    dimensions.documentWidth,
    `document overflow: ${JSON.stringify(dimensions)}`,
  ).toBeLessThanOrEqual(dimensions.viewportWidth + tolerance);
  expect(dimensions.bodyWidth, `body overflow: ${JSON.stringify(dimensions)}`).toBeLessThanOrEqual(
    dimensions.viewportWidth + tolerance,
  );
}

export async function expectInside(inner: Locator, outer: Locator, label: string) {
  const [innerBox, outerBox] = await Promise.all([inner.boundingBox(), outer.boundingBox()]);
  expect(innerBox, `${label}: inner box missing`).not.toBeNull();
  expect(outerBox, `${label}: outer box missing`).not.toBeNull();
  if (!innerBox || !outerBox) return;
  expect(innerBox.x, `${label}: left clipped`).toBeGreaterThanOrEqual(outerBox.x - tolerance);
  expect(innerBox.y, `${label}: top clipped`).toBeGreaterThanOrEqual(outerBox.y - tolerance);
  expect(innerBox.x + innerBox.width, `${label}: right clipped`).toBeLessThanOrEqual(
    outerBox.x + outerBox.width + tolerance,
  );
  expect(innerBox.y + innerBox.height, `${label}: bottom clipped`).toBeLessThanOrEqual(
    outerBox.y + outerBox.height + tolerance,
  );
}

function overlaps(a: Box, b: Box, pad = 1) {
  return !(
    a.x + a.width <= b.x + pad ||
    b.x + b.width <= a.x + pad ||
    a.y + a.height <= b.y + pad ||
    b.y + b.height <= a.y + pad
  );
}

export async function expectNoOverlap(a: Locator, b: Locator, label: string) {
  const [aBox, bBox] = await Promise.all([a.boundingBox(), b.boundingBox()]);
  if (!aBox || !bBox) return;
  expect(overlaps(aBox, bBox), `${label}: elements overlap`).toBe(false);
}

export async function expectCenterHitTarget(locator: Locator, label: string) {
  await locator.scrollIntoViewIfNeeded();
  await expect(locator, `${label}: not visible`).toBeVisible();
  const result = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    const x = Math.max(0, Math.min(innerWidth - 1, rect.left + rect.width / 2));
    const y = Math.max(0, Math.min(innerHeight - 1, rect.top + rect.height / 2));
    const hit = document.elementFromPoint(x, y);
    return {
      ok: hit === element || (!!hit && element.contains(hit)),
      hit: hit ? `${hit.tagName}.${(hit as HTMLElement).className}` : null,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    };
  });
  expect(result.ok, `${label}: center is occluded by ${result.hit}; ${JSON.stringify(result.rect)}`).toBe(true);
}

export async function expectSquare(locator: Locator, label: string, allowedDelta = 2) {
  const box = await locator.boundingBox();
  expect(box, `${label}: box missing`).not.toBeNull();
  if (!box) return;
  expect(Math.abs(box.width - box.height), `${label}: distorted ${box.width}x${box.height}`).toBeLessThanOrEqual(
    allowedDelta,
  );
}

export async function expectMinimumControlSize(locator: Locator, label: string, minimum = 40) {
  const box = await locator.boundingBox();
  expect(box, `${label}: box missing`).not.toBeNull();
  if (!box) return;
  expect(box.width, `${label}: too narrow`).toBeGreaterThanOrEqual(minimum);
  expect(box.height, `${label}: too short`).toBeGreaterThanOrEqual(minimum);
}

export async function expectIntentionalScroller(locator: Locator, label: string) {
  const info = await locator.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    overflowX: getComputedStyle(element).overflowX,
  }));
  expect(['auto', 'scroll'], `${label}: must own its horizontal overflow`).toContain(info.overflowX);
  expect(info.scrollWidth, `${label}: invalid scroll metrics`).toBeGreaterThanOrEqual(info.clientWidth);
}

export async function expectNoUnexpectedConsoleErrors(page: Page, errors: string[]) {
  expect(errors, `console/page errors:\n${errors.join('\n')}`).toEqual([]);
}
