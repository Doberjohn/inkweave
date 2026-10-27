import type {BrowserContext, Page} from '@playwright/test';

/** A 1x1 PNG: any card art at all. */
const ART = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
  'base64',
);

/**
 * Answers every card art request with any art at all, at once. The `page` fixture calls it before
 * the first navigation, for every spec that doesn't set `realCardArt`, and the warm-up
 * (global-setup.ts) for its whole context, since art would hold up the module loads it waits on.
 *
 * In E2E the art is proxied to Ravensburger's CDN through the test server (dev or preview), whose
 * HTTP/1.1 gives the page six connections to it. Art that hangs there can hold all six, and a page's
 * lazy code and data then wait behind it past a test's timeout: a card window's (#1022, #1050).
 * Art that fails instead shows the card's cost, which a pocket's name lacks. A spec's own route
 * for the art, registered later, runs first, so it still decides what its tests see.
 */
export async function stubCardArt(target: Page | BrowserContext): Promise<void> {
  await target.route('**/card-images/**', (route) =>
    route.request().resourceType() === 'image'
      ? route.fulfill({contentType: 'image/png', body: ART})
      : route.fallback(),
  );
}
