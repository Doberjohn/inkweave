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
});
