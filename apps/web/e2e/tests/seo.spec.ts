import {test, expect} from '../fixtures';

test.describe('SEO', () => {
  test('should have valid JSON-LD structured data on home page', async ({appPage, page}) => {
    await appPage.goto();

    const jsonLd = await page.evaluate(() => {
      const script = document.querySelector('script[type="application/ld+json"]');
      return script ? JSON.parse(script.textContent || '') : null;
    });

    expect(jsonLd).not.toBeNull();
    expect(jsonLd['@type']).toBe('WebApplication');
    expect(jsonLd.name).toBe('Inkweave');
    expect(jsonLd.url).toBeTruthy();
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
