import type {Locator, Page} from '@playwright/test';

/**
 * Moves the pointer from wherever it is onto `target`'s centre in small steps, as a hand would,
 * crossing any gap on the way, which a one-step jump skips.
 */
export async function slidePointerOnto(page: Page, target: Locator) {
  const box = await target.boundingBox();
  if (!box) throw new Error('slidePointerOnto: the target has no box');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, {steps: 10});
}
