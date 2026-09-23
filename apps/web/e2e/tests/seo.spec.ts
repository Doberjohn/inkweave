import {test, expect} from '../fixtures';
import {gotoWithRetry} from '../pages/vote.page';

/** Must match apps/web/index.html's static <title> byte-for-byte (note the em dash). */
const SHELL_TITLE = 'Inkweave — Master Lorcana Synergies';
const SITE_ORIGIN = 'https://inkweave.ink';

/**
 * One route per indexable page type. #486's central acceptance criterion was that
 * every route self-references its own canonical — nothing asserted it until now, and
 * /vote was shipped into the sitemap without a <Seo> as a direct result.
 */
const INDEXABLE_ROUTES = [
  '/',
  '/browse',
  '/playstyles',
  '/playstyles/lore-denial',
  '/card/1989/elsa-snow-queen',
  '/inks',
  '/ink/steel',
];

test.describe('SEO', () => {
  for (const route of INDEXABLE_ROUTES) {
    test(`should own its title and canonical: ${route}`, async ({page}) => {
      await gotoWithRetry(page, route);

      // React 19 hoists the <Seo> title but leaves index.html's shell <title> in the
      // DOM — prerender.mjs strips the duplicate at capture time (#492), and E2E runs
      // against the dev server, so asserting a count of one would fail for a reason
      // unrelated to the page. The effective title is what crawlers and users see.
      await expect
        .poll(() => page.title(), {message: `<Seo> never replaced the shell title on ${route}`})
        .not.toBe(SHELL_TITLE);

      const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
      expect(canonical, `${route} must self-reference, not point at another page`).toBe(
        `${SITE_ORIGIN}${route}`,
      );
    });
  }

  /**
   * /reveals is NOT in INDEXABLE_ROUTES because it is season-gated: off-season the
   * route redirects to '/', and a hard assertion would fail for a reason unrelated
   * to SEO. It gets its own self-gating test because it is the one route with no
   * prerendered file of its own, so in production Vercel's rewrite answers it with
   * the HOME page's prerendered HTML. Those tags carry `data-seo`, the sweep in
   * main.tsx removes them, and before this page rendered a <Seo> nothing replaced
   * them: production served /reveals with no title and no canonical at all.
   */
  test('reveals page owns its title and canonical when in season', async ({page}) => {
    await gotoWithRetry(page, '/reveals');
    test.skip(new URL(page.url()).pathname !== '/reveals', 'reveal season is over');

    await expect
      .poll(() => page.title(), {message: '<Seo> never replaced the shell title on /reveals'})
      .not.toBe(SHELL_TITLE);

    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical, '/reveals must self-reference, not inherit the homepage canonical').toBe(
      `${SITE_ORIGIN}/reveals`,
    );
  });

  /**
   * #535 duplication guard.
   *
   * The prerender crawl bakes React's hoisted <Seo> tags into the static HTML; on a real
   * visit React does not recognise them as its own and hoists a second copy of all eight
   * (measured: title/description/canonical 1 -> 2, og 8 -> 11, twitter 4 -> 6, every
   * route). `sweepPrerenderedSeoTags()` in main.tsx removes `head [data-seo]` before
   * render so React's copy is the only one.
   *
   * These specs run against the DEV server, which serves the shell rather than
   * prerendered files, so the baked-in duplicate does not exist here and the count going
   * 1 -> 2 cannot be reproduced. What IS reproducible, and what actually regresses, is
   * the marker contract: every tag <Seo> owns must carry `data-seo` (an unmarked one
   * escapes the sweep and silently reintroduces the bug), and SPA navigation must swap
   * metadata in place rather than accumulate it.
   */
  test('every tag <Seo> emits carries the data-seo sweep marker', async ({page}) => {
    await gotoWithRetry(page, '/ink/steel');

    // <title> is checked separately, qualified by [data-seo]. A bare `head title` count is
    // 2 on the dev server — index.html's shell title is still present, and prerender.mjs
    // strips it only at capture time (#492/#494). The marker is what distinguishes the tag
    // <Seo> manages from the shell's, and it is the one that must be swept: title was among
    // the tags measured duplicating 1 -> 2, and it is the most user-visible of them.
    await expect
      .poll(() => page.locator('head title[data-seo]').count(), {
        message: 'the <Seo>-managed title must carry data-seo exactly once',
      })
      .toBe(1);

    for (const selector of [
      'link[rel="canonical"]',
      'meta[name="description"]',
      'meta[property="og:title"]',
      'meta[property="og:url"]',
      'meta[property="og:description"]',
      'meta[name="twitter:title"]',
      'meta[name="twitter:description"]',
    ]) {
      await expect
        .poll(() => page.locator(`head ${selector}`).count(), {
          message: `${selector} should appear exactly once`,
        })
        .toBe(1);

      expect(
        await page.locator(`head ${selector}`).getAttribute('data-seo'),
        `${selector} is missing data-seo, so sweepPrerenderedSeoTags() will not remove its
         prerendered copy and the tag will duplicate on every real visit`,
      ).not.toBeNull();
    }
  });

  test('client navigation swaps metadata in place instead of accumulating it', async ({page}) => {
    await gotoWithRetry(page, '/inks');
    const canonicalCount = () => page.locator('head link[rel="canonical"]').count();
    await expect.poll(canonicalCount).toBe(1);

    // In-app navigation — no document load, so React re-hoists into the existing <head>.
    await page.getByRole('link', {name: 'Steel'}).first().click();
    await page.waitForURL('**/ink/steel');

    await expect
      .poll(() => page.locator('head link[rel="canonical"]').getAttribute('href'), {
        message: 'canonical did not follow the client-side navigation',
      })
      .toBe(`${SITE_ORIGIN}/ink/steel`);
    // The failure this guards: a second canonical appended beside the first. Two of them
    // makes Google ignore canonicalisation entirely, which is worse than emitting none.
    expect(await canonicalCount()).toBe(1);
    expect(await page.locator('head meta[property="og:url"]').count()).toBe(1);
  });

  /**
   * index.html carries site-level constants that <Seo> never emits. The sweep is scoped
   * to [data-seo] precisely so these survive it — widening that selector would strip them
   * on every page load, and nothing else asserts they exist.
   */
  test('sweep preserves index.html site-level constants', async ({page}) => {
    await gotoWithRetry(page, '/ink/steel');
    for (const selector of [
      'meta[property="og:type"]',
      'meta[property="og:locale"]',
      'meta[property="og:image:width"]',
      'meta[property="og:image:height"]',
      'meta[name="twitter:card"]',
    ]) {
      await expect
        .poll(() => page.locator(`head ${selector}`).count(), {
          message: `${selector} is a site-level constant and must survive the sweep`,
        })
        .toBe(1);
    }
  });

  // Googlebot renders mobile, and CardPage gates the desktop CardDetailPanel behind
  // !isMobile while MobileCardDetail owns the h1 on small viewports. A regression in
  // either branch is invisible at desktop width.
  test('card page has exactly one h1 at a mobile viewport', async ({page}) => {
    await page.setViewportSize({width: 412, height: 915});
    await gotoWithRetry(page, '/card/1989/elsa-snow-queen');

    await expect(page.locator('h1')).toHaveCount(1);
    await expect(page.locator('h1')).toContainText('Elsa');
  });

  test('should have valid JSON-LD structured data on home page', async ({appPage, page}) => {
    await appPage.goto();

    const jsonLd = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent || '') : null;
    });

    expect(jsonLd).not.toBeNull();
    // #496: structured data is a schema.org @graph (Organization + WebSite + WebApplication),
    // cross-linked by @id. Assert all three node types plus the WebSite's SearchAction.
    const graph = jsonLd['@graph'] as Array<Record<string, unknown>>;
    expect(Array.isArray(graph)).toBe(true);
    expect(graph.map((node) => node['@type'])).toEqual(
      expect.arrayContaining(['Organization', 'WebSite', 'WebApplication']),
    );

    const app = graph.find((node) => node['@type'] === 'WebApplication');
    expect(app?.name).toBe('Inkweave');
    expect(app?.url).toBeTruthy();

    const website = graph.find((node) => node['@type'] === 'WebSite');
    expect((website?.potentialAction as Record<string, unknown>)?.['@type']).toBe('SearchAction');
  });

  test('should have correct heading hierarchy on home page', async ({appPage, page}) => {
    await appPage.goto();

    // Exactly one h1
    const h1Count = await page.locator('h1').count();
    expect(h1Count).toBe(1);

    // h1 wraps the animated Inkweave logo; accessible name comes from the img's alt.
    await expect(page.locator('h1 img')).toHaveAttribute('alt', 'Inkweave');
  });

  test('should preload self-hosted fonts', async ({page, appPage}) => {
    await appPage.goto();

    const preloads = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="preload"][as="font"]');
      return Array.from(links).map((l) => l.getAttribute('href'));
    });

    expect(preloads).toContain('/fonts/plus-jakarta-sans-400.woff2');
    expect(preloads).toContain('/fonts/tinos-400.woff2');
  });

  /**
   * The internal-link guarantee from #530.
   *
   * Ink is the only total partition of the corpus, so these six footer links are what put
   * every one of the 1,024 card pages within one click of a hub — and every card within
   * one click back. Asserted at a MOBILE viewport because that is the regression that
   * matters: Googlebot renders mobile, and the orphan gap exists precisely because synergy
   * adjacency truncates to 5 partners there with a <button>, not a link, as the overflow.
   */
  test('card page links to all six ink hubs at a mobile viewport', async ({page}) => {
    await page.setViewportSize({width: 412, height: 915});
    await gotoWithRetry(page, '/card/1989/elsa-snow-queen');

    // Against the dev server the page renders a skeleton until card data arrives, and the
    // footer mounts with it — poll rather than assert on the first frame.
    await expect(page.locator('footer a[href^="/ink/"]')).toHaveCount(6);

    const hrefs = await page
      .locator('footer a[href^="/ink/"]')
      .evaluateAll((links) => links.map((l) => l.getAttribute('href')));

    expect(hrefs.sort()).toEqual([
      '/ink/amber',
      '/ink/amethyst',
      '/ink/emerald',
      '/ink/ruby',
      '/ink/sapphire',
      '/ink/steel',
    ]);
  });

  /**
   * A hub must emit a real anchor per card, not a virtualized window. BrowseCardGrid's
   * Virtuoso only mounts visible rows, so swapping it in here would render correctly in a
   * browser while emitting a fraction of the links to a crawler — silently defeating the
   * only thing these pages exist to do.
   */
  test('ink hub emits one crawlable anchor per card, identically on mobile', async ({page}) => {
    await gotoWithRetry(page, '/ink/steel');
    // The hub renders CardGridSkeleton until card data loads, so poll for the settled
    // count rather than reading the first frame (which is legitimately 0).
    await expect
      .poll(() => page.locator('a[href^="/card/"]').count(), {timeout: 15000})
      .toBeGreaterThan(150);
    const desktopCount = await page.locator('a[href^="/card/"]').count();

    await page.setViewportSize({width: 412, height: 915});
    await gotoWithRetry(page, '/ink/steel');
    // Equality is the assertion, not the magnitude: a viewport-dependent count would
    // reproduce the exact bug this issue closes.
    await expect
      .poll(() => page.locator('a[href^="/card/"]').count(), {timeout: 15000})
      .toBe(desktopCount);
  });

  test('unknown ink slug renders the 404 page, not an empty hub', async ({page}) => {
    await gotoWithRetry(page, '/ink/nonsense');
    // A thin 200 on a junk URL is what #525's NotFoundPage <Seo> exists to prevent.
    await expect(page.locator('meta[name="robots"][content="noindex"]')).toHaveCount(1);
  });
});
