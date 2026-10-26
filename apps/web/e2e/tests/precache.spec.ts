import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';

// The service worker's precache (#928) and the small symbols it keeps on screen offline (#934).
// E2E blocks service workers, so the precache tests read the list a production build's sw.js
// would install rather than run it, and skip on the dev server, which writes none. E2E builds with
// every flag on, where each chunk is one some page loads, so the precache may leave none out.

/** The routes #928 opened offline, a missing page included. */
const ROUTES = [
  '/',
  '/browse',
  '/card/1939',
  '/playstyles',
  '/playstyles/discard',
  '/vote',
  '/inks',
  '/ink/amber',
  '/about',
  '/release-notes',
  '/account',
  '/no-such-page',
];

const INKS = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

/** The ten small symbols the precache keeps (#934): the inks, the inkwell, common and uncommon. */
const SYMBOLS = [...INKS.map((ink) => ink.toLowerCase()), 'common', 'inkable', 'uncommon', 'uninkable'];

/** The files sw.js precaches, as its manifest names them (`assets/BrowsePage-<hash>.js`). */
async function precached(page: Page): Promise<Set<string>> {
  const response = await page.request.get('/sw.js');
  expect(response.ok(), 'sw.js').toBe(true);
  return new Set([...(await response.text()).matchAll(/url:"([^"]+)"/g)].map((match) => match[1]));
}

/**
 * The address of each ink's symbol on a card placeholder (`.ink-card-placeholder`, in
 * inkweave-ui's styles/lorcana.css).
 */
function placeholderSymbols(page: Page) {
  return page.evaluate((inks) => {
    return inks.map((ink) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'ink-card-placeholder';
      placeholder.dataset.ink = ink;
      document.body.append(placeholder);
      const image = getComputedStyle(placeholder, '::before').backgroundImage;
      placeholder.remove();
      return image.match(/^url\("?(.*?)"?\)$/)?.[1] ?? image;
    });
  }, INKS);
}

/** The filter groups' images that are data URIs rather than files, named by group and place. */
function inlined(groups: Record<string, string[]>): string[] {
  return Object.entries(groups).flatMap(([group, sources]) =>
    sources.flatMap((src, i) => (src.startsWith('data:') ? [`${group} ${i + 1}`] : [])),
  );
}

test.describe('The service worker precache', () => {
  test.skip(process.env.E2E_SERVER !== 'preview', 'only a production build writes sw.js');

  test('lists every script the pages load', async ({page}) => {
    test.setTimeout(120_000);
    const files = await precached(page);
    const loaded = new Set<string>();
    page.on('request', (request) => {
      const file = new URL(request.url()).pathname.slice(1);
      if (/^assets\/[^/]+\.js$/.test(file)) loaded.add(file);
    });
    for (const route of ROUTES) await page.goto(route, {waitUntil: 'networkidle'});
    // At least each page's own chunk, so the listener heard the loads.
    expect(loaded.size).toBeGreaterThanOrEqual(ROUTES.length);
    expect([...loaded].filter((file) => !files.has(file))).toEqual([]);
  });

  test('lists exactly the ten small symbols', async ({page}) => {
    const symbols = [...(await precached(page))]
      .filter((file) => file.endsWith('.svg'))
      .map((file) => file.replace(/^assets\/([a-z_]+)-[\w-]+\.svg$/, '$1'));
    expect(symbols.sort()).toEqual([...SYMBOLS].sort());
  });
});

test.describe("Browse's filter symbols", () => {
  // A production build would inline any of them under 4 kB into the JavaScript as a data URI
  // unless it is imported `?no-inline` (#934); the dev server serves every one as a file.
  test('are files, each ink the one its card placeholders draw', async ({page}, testInfo) => {
    await page.goto('/browse');
    const phone = testInfo.project.name.startsWith('mobile-');
    if (phone) await page.getByRole('button', {name: 'Filters', exact: true}).click();
    const filters = phone
      ? page.getByRole('dialog', {name: 'Filters'})
      : page.getByRole('complementary', {name: 'Filters'});
    await expect(filters.getByRole('button', {name: 'Filter by Amber'})).toBeVisible();
    const sources = (group: string) =>
      filters
        .getByRole('group', {name: group})
        .locator('img')
        .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).src));

    const inks = await sources('Ink color filters');
    const inkwell = await sources('Inkwell filters');
    const rarities = await sources('Rarity filters');
    expect([inks.length, inkwell.length]).toEqual([INKS.length, 2]);
    expect(rarities.length).toBeGreaterThanOrEqual(5);
    expect(inlined({inks, inkwell, rarities})).toEqual([]);
    // The same file, so a page showing an ink's icon and its placeholders downloads it once.
    expect(inks).toEqual(await placeholderSymbols(page));
  });
});
