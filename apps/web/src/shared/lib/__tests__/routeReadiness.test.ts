import {afterEach, describe, expect, it, vi} from 'vitest';
import {matchRoutes, type RouteObject} from 'react-router-dom';
import {_resetPrerenderedArt, prerenderedArtShown} from 'inkweave-ui/lib/prerenderedArt';
import {readyWhen, whenRouteReady} from '../routeReadiness';
import {showPrerenderedArt} from 'inkweave-ui/test-utils/loadedArt';
import prerenderedRoutes from '../../../prerenderedRoutes.json';

/** A promise and the function that settles it, so a test can hold a ready open. */
function held() {
  let release!: () => void;
  const promise = new Promise<void>((resolve) => (release = resolve));
  return {promise, release};
}

describe('whenRouteReady', () => {
  it('waits for every route the path matches, each with its params', async () => {
    const layout = held();
    const page = held();
    const pageReady = vi.fn(() => page.promise);
    const routes: RouteObject[] = [
      {
        path: '/',
        handle: {ready: () => layout.promise},
        children: [{path: 'card/:cardId', handle: {ready: pageReady}}],
      },
    ];
    let ready = false;
    void whenRouteReady(routes, '/card/1936').then(() => (ready = true));

    page.release();
    await new Promise((resolve) => setTimeout(resolve));
    expect(ready).toBe(false);
    layout.release();
    await vi.waitFor(() => expect(ready).toBe(true));
    expect(pageReady).toHaveBeenCalledWith(expect.objectContaining({cardId: '1936'}));
  });

  it('resolves at once for a path whose routes wait for nothing', async () => {
    const routes: RouteObject[] = [{path: '/', handle: {speedInsightsRoute: '/'}}];

    await expect(whenRouteReady(routes, '/')).resolves.toBeUndefined();
    await expect(whenRouteReady(routes, '/no-such-page')).resolves.toBeUndefined();
  });

  // A failure first doesn't end the hold while the rest are still coming.
  it('settles once each route has what it waits for or has failed to get it', async () => {
    const page = held();
    const routes: RouteObject[] = [
      {
        path: '/',
        handle: {ready: () => Promise.reject(new Error('offline'))},
        children: [{path: 'browse', handle: {ready: () => page.promise}}],
      },
    ];
    let settled = false;
    const ready = whenRouteReady(routes, '/browse').finally(() => (settled = true));

    await new Promise((resolve) => setTimeout(resolve));
    expect(settled).toBe(false);
    page.release();
    await expect(ready).resolves.toBeUndefined();
  });
});

describe('readyWhen', () => {
  it("waits for the page's code and each of its requests, even after one fails", async () => {
    const code = held();
    const cards = held();
    const synergies = vi.fn(() => Promise.reject(new Error('offline')));
    const {ready} = readyWhen({preload: () => code.promise}, () => cards.promise, synergies);
    let settled = false;
    void ready({cardId: '1936'}).finally(() => (settled = true));

    await new Promise((resolve) => setTimeout(resolve));
    code.release();
    await new Promise((resolve) => setTimeout(resolve));
    expect(settled).toBe(false);
    cards.release();
    await vi.waitFor(() => expect(settled).toBe(true));
    expect(synergies).toHaveBeenCalledWith({cardId: '1936'});
  });
});

describe("router.tsx's readiness rules", () => {
  // Without one, main.tsx would let go of the prerendered page at once, and the app's first
  // frame would be the route's fallback (#915). The crawl's static routes come from
  // prerenderedRoutes.json; /reveals is crawled in season, and every playstyle and card page too.
  it('give every route the crawl prerenders something to wait for', async () => {
    const {router} = await import('../../../router');
    const crawled = [
      ...prerenderedRoutes,
      '/reveals',
      '/playstyles/lore-denial',
      '/card/1936/elsa-snow-queen',
    ];

    const without = crawled.filter((path) => {
      const handle = matchRoutes(router.routes, path)?.at(-1)?.route.handle as
        {ready?: unknown} | undefined;
      return typeof handle?.ready !== 'function';
    });

    expect(without).toEqual([]);
  });
});

describe("router.tsx and the prerendered page's art", () => {
  afterEach(() => _resetPrerenderedArt());

  // main.tsx remembers the art through the package's subpath and the package's own files reach
  // it by relative path: two copies of the module would each hold half of what was shown (#980).
  it("shares one record of the art between the app and inkweave-ui's own files", () => {
    showPrerenderedArt('/card-images/1936.avif');

    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(true);
  });

  // A page that shows no art looks none up, so only the router can tell that the visitor left.
  it('forgets the art once the visitor leaves its page, through pages without art too', async () => {
    const {router} = await import('../../../router');
    const page = router.state.location.pathname;
    showPrerenderedArt('/card-images/1936.avif');

    await router.navigate('/about');
    await router.navigate(page);

    expect(prerenderedArtShown('/card-images/1936.avif')).toBe(false);
  });
});
