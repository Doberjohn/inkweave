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

    // h1 contains the hero title
    await expect(page.locator('h1')).toContainText('LORCANA SYNERGIES');
  });

  test('should have font preconnect hints', async ({page, appPage}) => {
    await appPage.goto();

    const preconnects = await page.evaluate(() => {
      const links = document.querySelectorAll('link[rel="preconnect"]');
      return Array.from(links).map((l) => l.getAttribute('href'));
    });

    expect(preconnects).toContain('https://fonts.googleapis.com');
    expect(preconnects).toContain('https://fonts.gstatic.com');
  });
});
