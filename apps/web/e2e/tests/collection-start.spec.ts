import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {binder, COLLECTIONS_PATH, signedIn, signInAsCollector} from '../helpers/collector';
import {edges} from '../helpers/screen';

/**
 * Starting a collection with nothing to import (#1063, the owner's pick on 2026-10-28): the
 * Collection button, and the Account page's Open your binder, open an empty binder rather than
 * the import. Signed in as `collection-mode.spec.ts` is (`signInAsCollector`), holding nothing:
 * no local copy and no server row, whose route keeps what the account receives.
 *
 * The empty collection goes up only after a read of the account finds none, since on a new
 * browser that copy may be the collection: `collection-mode.spec.ts`'s new-browser test holds a
 * collection there and checks nothing goes up over it.
 */

/** What an empty collection's binder says on its inside front cover. */
const emptyNote = (page: Page) => binder(page).getByRole('heading', {name: 'Your binder is empty'});

test.describe('Starting a collection', () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  test.beforeEach(async ({page: _}, testInfo) => {
    // The header's Account control, which these wait on, and a spread's cover are the desktop's.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
  });

  test('a signed-in visitor without a collection gets an empty binder, whose cover offers the import, until a first copy goes in', async ({
    page,
  }) => {
    const writes = await signInAsCollector(page, null);
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();
    const cover = binder(page).getByRole('group', {name: 'Front cover', exact: true});
    await expect(cover.getByRole('heading', {name: 'Your binder is empty'})).toBeVisible();
    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toHaveCount(0);

    // The import is a press away, and an empty binder has nothing for it to replace.
    await cover.getByRole('button', {name: 'Import from Dreamborn'}).click();
    const dialog = page.getByRole('dialog', {name: 'Import your collection'});
    await expect(dialog).toBeVisible();
    await expect(dialog).not.toContainText('Importing replaces');
    await dialog.getByRole('button', {name: 'Cancel'}).click();
    await expect(dialog).toHaveCount(0);

    // A first copy from a pocket: the note goes, and the copy is saved.
    await binder(page).getByTestId('card-tile').first().hover();
    await binder(page)
      .getByRole('group', {name: '0 normal, 0 foil', exact: true})
      .getByRole('button', {name: 'Add one copy of normal', includeHidden: true})
      .click();
    await page.mouse.move(0, 0);
    await expect(emptyNote(page)).toHaveCount(0);
    await expect
      .poll(() => writes.some((entries) => Object.values(entries).some((entry) => entry.normal === 1)))
      .toBe(true);
  });

  test('when the account answers with no collection, the waiting binder opens empty and is saved to the account', async ({
    page,
  }) => {
    let answer = () => {};
    const answered = new Promise<void>((resolve) => (answer = resolve));
    const writes = await signInAsCollector(page, null, {local: false, answered});
    await page.goto('/browse');
    await signedIn(page);

    await page.getByRole('button', {name: 'Show my collection'}).click();
    // The binder waits for the account, whose copy may be the collection: nothing is started yet.
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(emptyNote(page)).toHaveCount(0);
    expect(writes).toEqual([]);

    answer();
    // Nothing came, so the empty collection starts, and the binder stays, its param with it.
    await expect(emptyNote(page)).toBeVisible();
    await expect(page).toHaveURL(/[?&]binder=all(&|$)/);
    await expect(page.getByRole('dialog', {name: 'Import your collection'})).toHaveCount(0);
    await expect.poll(() => writes).toEqual([{}]);
  });

  test("the account page's Open your binder opens an empty binder on Browse, saved to the account", async ({page}) => {
    const writes = await signInAsCollector(page, null);
    await page.goto('/account');
    await expect(page.getByRole('button', {name: 'Import collection'})).toBeVisible();

    // Held off while the account is checked, as Import collection is; the click waits for it.
    await page.getByRole('button', {name: 'Open your binder'}).click();
    await expect(page).toHaveURL(/\/browse\?binder=all$/);
    await expect(emptyNote(page)).toBeVisible();
    await expect.poll(() => writes).toEqual([{}]);
  });
});

test.describe('Starting a collection (phone width)', () => {
  // Every project: the phone binder is chosen by width (useResponsive), so a forced phone
  // viewport draws it anywhere, the chromium-only Windows pre-push included.
  test("an empty collection's binder opens on its cover, the note above the collection's numbers", async ({page}) => {
    await page.setViewportSize({width: 393, height: 815});
    await signInAsCollector(page, null);
    // Signed in once the account is read: a phone's header has no Account control to wait on.
    const read = page.waitForResponse((response) => new URL(response.url()).pathname === COLLECTIONS_PATH);
    await page.goto('/browse');
    await read;

    await page.getByRole('button', {name: 'Show my collection'}).click();
    const map = binder(page).getByRole('navigation', {name: 'Binder pages'});
    await expect(map.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Front cover: collection numbers');
    const cover = binder(page).getByRole('group', {name: 'Front cover', exact: true});
    const note = await edges(cover.getByRole('heading', {name: 'Your binder is empty'}));
    const counts = await edges(cover.getByRole('region', {name: 'Collection numbers'}));
    expect(note.bottom, 'the note above the numbers').toBeLessThanOrEqual(counts.top);
    await expect(cover.getByRole('button', {name: 'Import from Dreamborn'})).toBeVisible();
  });
});
