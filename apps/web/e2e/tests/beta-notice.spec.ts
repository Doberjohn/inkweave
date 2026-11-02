import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {startClockInRevealSeason} from '../helpers/revealSeason';

/**
 * The home page's beta notice (#1084): above the logo on phones and narrower screens, in the
 * page's top-left corner from 1400 px, never over the hero, and a way into the Discord.
 *
 * The desktop projects check every size; the phone projects their own screen, since a phone
 * emulator's layout viewport stops tracking a desktop-sized window.
 */

const INVITE = 'https://discord.gg/gvA6qUUPE';
/** The narrowest width at which the notice moves to the corner (index.css's `.beta-notice`). */
const CORNER_FROM = 1400;
/** Its distance from the page's top and left edges there: SPACING.xxxl. */
const CORNER_GUTTER = 32;

const SIZES = [
  {width: 390, height: 844},
  {width: 768, height: 1024},
  {width: 1024, height: 768},
  {width: 1280, height: 800},
  {width: 1399, height: 800},
  {width: 1400, height: 800},
  {width: 1440, height: 900},
  {width: 1920, height: 1080},
];

type Box = {x: number; y: number; width: number; height: number};

const isPhoneProject = (name: string) => name.startsWith('mobile-');
const notice = (page: Page) => page.getByRole('complementary', {name: 'Beta notice'});

/**
 * Opens the home page and waits for the page itself, not the router's fallback: the skeleton
 * draws the notice too, so a check made before the search box shows would pass on it alone.
 */
async function gotoHome(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByPlaceholder('Search for a card...')).toBeVisible();
  await expect(notice(page)).toBeVisible();
}

async function boxOf(locator: Locator): Promise<Box> {
  const box = await locator.boundingBox();
  if (!box) throw new Error(`${locator} has no box`);
  return box;
}

const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

/** Its Discord button whole inside it. */
async function expectButtonInside(page: Page, box: Box): Promise<void> {
  const link = await boxOf(notice(page).getByRole('link', {name: 'Join our Discord'}));
  expect(link.x).toBeGreaterThanOrEqual(box.x);
  expect(link.y).toBeGreaterThanOrEqual(box.y);
  expect(link.x + link.width).toBeLessThanOrEqual(box.x + box.width);
  expect(link.y + link.height).toBeLessThanOrEqual(box.y + box.height);
}

/** The hero's logo, subtitle, search box and buttons, each with what it is, for the failure message. */
async function heroParts(page: Page): Promise<{name: string; box: Box}[]> {
  const hero = page.locator('section[aria-label="Hero"]');
  const parts: {name: string; box: Box}[] = [
    {name: 'logo', box: await boxOf(hero.locator('h1 img'))},
    {name: 'subtitle', box: await boxOf(hero.getByText('Select any Lorcana card', {exact: false}))},
    {name: 'search box', box: await boxOf(page.getByPlaceholder('Search for a card...'))},
  ];
  for (const name of ['Browse all cards', 'Explore playstyles', 'Rate synergies']) {
    parts.push({name, box: await boxOf(hero.getByRole('button', {name}))});
  }
  return parts;
}

for (const size of SIZES) {
  const corner = size.width >= CORNER_FROM;
  test(`at ${size.width}x${size.height} the notice sits ${corner ? 'in the corner' : 'above the logo'}, clear of the hero`, async ({
    page,
  }, testInfo) => {
    const phoneProject = isPhoneProject(testInfo.project.name);
    test.skip(phoneProject && size.width !== 390, 'Phone projects check their own screen');
    if (!phoneProject) await page.setViewportSize(size);
    await gotoHome(page);

    const box = await boxOf(notice(page));
    const parts = await heroParts(page);
    for (const part of parts) {
      expect(overlaps(box, part.box), `the notice covers the hero's ${part.name}`).toBe(false);
    }

    // Inside the page, which it never widens.
    const pageWidth = await page.evaluate(() => document.documentElement.clientWidth);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(pageWidth);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(pageWidth);

    await expectButtonInside(page, box);

    const logo = parts[0].box;
    if (corner) {
      expect(box.x).toBeCloseTo(CORNER_GUTTER, 0);
      expect(box.y).toBeCloseTo(CORNER_GUTTER, 0);
      expect(box.x + box.width).toBeLessThan(Math.min(...parts.map((part) => part.box.x)));
    } else {
      expect(box.y + box.height).toBeLessThanOrEqual(logo.y);
    }
  });
}

// In reveal season the Reveals promo sits fixed in the top-right corner from 768 px, and at the
// foot of the screen on a phone (RevealsPromoCard).
for (const size of SIZES) {
  test(`in reveal season at ${size.width}x${size.height} the Reveals promo leaves the notice clear`, async ({
    page,
  }, testInfo) => {
    const phoneProject = isPhoneProject(testInfo.project.name);
    test.skip(phoneProject && size.width !== 390, 'Phone projects check their own screen');
    test.skip(!(await startClockInRevealSeason(page)), 'previewCards.json has no dated reveal set');
    if (!phoneProject) await page.setViewportSize(size);
    await gotoHome(page);
    const promo = page.getByRole('complementary', {name: /reveals$/});
    await expect(promo).toBeVisible();

    const box = await boxOf(notice(page));
    const promoBox = await boxOf(promo);
    expect(overlaps(box, promoBox), 'the Reveals promo covers the notice').toBe(false);
    for (const part of await heroParts(page)) {
      expect(overlaps(box, part.box), `the notice covers the hero's ${part.name}`).toBe(false);
    }
    await expectButtonInside(page, box);
  });
}

test('in the corner the notice scrolls away with the page, never over the featured cards', async ({page}, testInfo) => {
  test.skip(isPhoneProject(testInfo.project.name), 'The corner layout needs a wide screen');
  await page.setViewportSize({width: 1440, height: 900});
  await gotoHome(page);

  await page.evaluate(() => window.scrollTo(0, 200));
  const scrolled = await page.evaluate(() => window.scrollY);
  expect(scrolled).toBeGreaterThan(0);
  expect((await boxOf(notice(page))).y).toBeCloseTo(CORNER_GUTTER - scrolled, 0);
});

test('the notice says the collection is in beta and thanks the people testing it', async ({page}) => {
  await gotoHome(page);
  await expect(notice(page)).toContainText('Collection is in beta');
  await expect(notice(page)).toContainText('Thanks for testing! Found a bug or have an idea? Tell us on Discord.');
});

test("the notice's Discord button opens the invite in a new tab", async ({page, context}) => {
  // The invite never leaves the test: Discord answers with a stand-in page.
  await context.route('https://discord.gg/**', (route) => route.fulfill({contentType: 'text/html', body: '<p>Discord</p>'}));
  await gotoHome(page);
  const link = notice(page).getByRole('link', {name: 'Join our Discord'});
  await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

  const [tab] = await Promise.all([context.waitForEvent('page'), link.click()]);
  await expect.poll(() => tab.url()).toBe(INVITE);
  expect(page.url()).toMatch(/\/$/);
});

test('only the home page shows the notice', async ({page}) => {
  await gotoHome(page);
  await page.goto('/browse');
  await expect(page.getByTestId('card-tile').first()).toBeVisible();
  await expect(notice(page)).toHaveCount(0);
});
