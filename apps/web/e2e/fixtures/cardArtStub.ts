import type {BrowserContext, Page} from '@playwright/test';

/**
 * A 1x1 opaque mid-grey PNG: art enough for a card, and opaque, so a check that reads the screen
 * over a card (a foil's finish, a pocket's contrast) still finds a picture under it.
 */
export const ART = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR42mNoaGgAAAMEAYF1LgG8AAAAAElFTkSuQmCC',
  'base64',
);

/**
 * The paths the loader builds for card art (`resolveImageUrl`, `smallImageUrl`): Ravensburger's
 * `{lang}/{set}/{number}_{sha1}.jpg` behind the proxy, and our hashed `{id}.{hash}(-sm).avif`.
 */
const LOADER_ART = /^\/card-images\/(?:[a-z]{2}\/[a-z0-9]+\/[0-9][0-9a-z]*_[0-9a-f]{40}\.jpg|[^/]+\.[0-9a-f]{16}(?:-sm)?\.avif)$/i;

/**
 * Answers every card art request with ART, at once. The `page` fixture calls it before every
 * spec's first navigation, and the warm-up (global-setup.ts) for its whole context, since art
 * would hold up the module loads it waits on.
 *
 * In E2E the art is proxied to Ravensburger's CDN through the test server (dev or preview), whose
 * HTTP/1.1 gives the page six connections to it. Art that hangs there can hold all six, and a page's
 * lazy code and data then wait behind it past a test's timeout: a card window's (#1022, #1050).
 * Art that fails instead shows the card's cost, which a pocket's name lacks. A spec's own route
 * for the art, registered later, runs first, so it still decides what its tests see, and a spec
 * that ever needs the real art can send it on with `route.continue()`.
 *
 * Only a path the loader builds gets the stand-in. Any other goes on to the proxy and, there,
 * fails, as before, so a broken art URL still shows a card's cost where a test expects its art.
 */
export async function stubCardArt(target: Page | BrowserContext): Promise<void> {
  await target.route('**/card-images/**', (route) =>
    route.request().resourceType() === 'image' && LOADER_ART.test(new URL(route.request().url()).pathname)
      ? route.fulfill({contentType: 'image/png', body: ART})
      : route.fallback(),
  );
}
