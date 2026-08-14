import type {BrowserContext, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {signInAs, TEST_USER_ID} from '../helpers/deckBackend';
import {CollectionBackend, COLLECTION_KEY} from '../helpers/collectionBackend';

/**
 * #555's acceptance criterion, end to end: a signed-in user's collection
 * survives moving to a different browser.
 *
 * WHY THIS SPEC EXISTS. Every other check on the sync is a unit test against a
 * stubbed repository, which can only ever prove that the decision function is
 * right — never that the app calls it at the right moment with the right data.
 * The schema half was proven separately with a JWT-simulated probe against the
 * live database. This is the half neither of those reaches.
 *
 * Two contexts share ONE `CollectionBackend`, which is what makes "device A" and
 * "device B" meaningful: same account, same table, different localStorage.
 *
 * `/account` is the surface under test because it states ownership as a plain
 * number, so an assertion here does not depend on the binder's layout.
 */

const OWNED = {
  '1936': {normal: 2, foil: 0},
  '1937': {normal: 1, foil: 1},
  '1938': {normal: 1, foil: 0},
};

/** Put a collection in this context's localStorage, as a prior import would. */
async function seedLocalCollection(
  context: BrowserContext,
  entries: Record<string, {normal: number; foil: number}>,
  importedAt = 1_700_000_000_000,
): Promise<void> {
  await context.addInitScript(
    ([key, value]: [string, string]) => window.localStorage.setItem(key, value),
    [COLLECTION_KEY, JSON.stringify({schemaVersion: 1, importedAt, entries})] as [string, string],
  );
}

/** The "Cards owned" row on /account, which only renders when signed in. */
function ownedRow(page: Page) {
  return page.getByText('Cards owned').locator('..');
}

test.describe('Collection sync', () => {
  test('a collection imported on one device is readable on another', async ({browser}) => {
    const backend = new CollectionBackend();

    // Device A: signed in, holding a collection this browser imported. `alreadyMigrated`
    // false so the first-sign-in upload actually runs — that is the behaviour under test.
    const deviceA = await browser.newContext();
    await signInAs(deviceA, {alreadyMigrated: false});
    await backend.attach(deviceA, TEST_USER_ID);
    await seedLocalCollection(deviceA, OWNED);

    const pageA = await deviceA.newPage();
    await pageA.goto('/account');
    await expect(ownedRow(pageA)).toContainText('3');

    // The upload is fire-and-forget, so wait on the store rather than on the UI.
    await expect.poll(() => backend.get(TEST_USER_ID)?.entries).toEqual(OWNED);

    // Device B: same account, EMPTY localStorage. Nothing but the table can
    // supply the collection here, which is the whole assertion.
    const deviceB = await browser.newContext();
    await signInAs(deviceB);
    await backend.attach(deviceB, TEST_USER_ID);

    const pageB = await deviceB.newPage();
    await pageB.goto('/account');
    await expect(ownedRow(pageB)).toContainText('3');

    await deviceA.close();
    await deviceB.close();
  });

  test('the account copy wins over a stale local one', async ({browser}) => {
    const backend = new CollectionBackend();
    // Two cards on the server, one different card locally.
    backend.seed(TEST_USER_ID, OWNED);

    const context = await browser.newContext();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);
    await seedLocalCollection(context, {'9999': {normal: 1, foil: 0}});

    const page = await context.newPage();
    await page.goto('/account');

    // Owner ruling 2026-08-11: server wins, because a collection is one row and
    // uploading over it would destroy a remote import with no undo.
    await expect(ownedRow(page)).toContainText('3');
    expect(backend.get(TEST_USER_ID)?.entries).toEqual(OWNED);

    await context.close();
  });

  test('a signed-out visitor never writes to the account', async ({browser}) => {
    const backend = new CollectionBackend();

    // Anonymous, but holding a local collection — the state that would tempt a
    // naive sync into uploading on behalf of nobody.
    const context = await browser.newContext();
    await backend.attach(context, null);
    await seedLocalCollection(context, OWNED);

    const page = await context.newPage();
    await page.goto('/browse');
    await expect(page.getByRole('button', {name: 'Show my collection'})).toBeVisible();

    expect(backend.writeCount).toBe(0);
    expect(backend.get(TEST_USER_ID)).toBeUndefined();

    await context.close();
  });

  test('a cleared collection does not come back from the account', async ({browser}) => {
    const backend = new CollectionBackend();
    backend.seed(TEST_USER_ID, OWNED);

    const context = await browser.newContext();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);

    const page = await context.newPage();
    await page.goto('/account');
    await expect(ownedRow(page)).toContainText('3');

    await page.getByRole('button', {name: 'Clear', exact: true}).click();
    await page.getByRole('button', {name: 'Delete my collection'}).click();

    // Clearing must reach the account too, or it reappears on the next device
    // and reads as the delete having failed.
    await expect.poll(() => backend.get(TEST_USER_ID)).toBeUndefined();
    await page.reload();
    await expect(page.getByText('Import a Dreamborn CSV export')).toBeVisible();

    await context.close();
  });
});
