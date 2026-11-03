import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {collectionChunk, collectionPromoList, setCards} from '../helpers/cardData';
import {signedIn, signInAsCollector, type Entries} from '../helpers/collector';

/**
 * Importing a Dreamborn collection export (#553): the file goes through the CSV parser against
 * the whole card list, the dialog's receipt says what came in and what didn't, and the
 * collection goes to the account. Signed in as `collection-mode.spec.ts` is (`signInAsCollector`),
 * whose route keeps each collection the page uploads.
 */

/**
 * A card of a set that no other card or printing of the set shares its number with, so its row
 * names it alone. The parser reads a set's numbers off the whole card list: a Core set's cards
 * from `allCards.json` and its printings from its chunk, a set before Core from its chunk alone.
 */
function aloneAtItsNumber(setCode: string) {
  const numbered: {id: number | string; fullName: string; number?: number; baseId?: number}[] = [
    ...setCards(setCode),
    ...collectionChunk(setCode),
  ];
  const card = numbered.find(
    (c) =>
      c.baseId === undefined &&
      (c.number ?? 0) > 10 &&
      numbered.filter((other) => other.number === c.number).length === 1,
  );
  if (!card) throw new Error(`Fixture broken: no card of set ${setCode} stands alone at its number`);
  return {...card, number: card.number!};
}

const CORE = aloneAtItsNumber('13');
const OLDER = aloneAtItsNumber('3');
/**
 * A promo of a card the list holds, which its code and number name alone, with no art letter or
 * finish to tell twins apart.
 */
const PROMO = (() => {
  const promos = collectionPromoList();
  const promo = promos.find(
    (p) =>
      p.baseId !== undefined &&
      !p.finish &&
      !p.artVariant &&
      promos.filter((other) => other.promoGrouping === p.promoGrouping && other.number === p.number).length === 1,
  );
  if (!promo) throw new Error('Fixture broken: no promo stands alone at its code');
  return promo;
})();

/** A card the export lists with no copies: a census row, as every row of a real export is. */
const UNOWNED = setCards('13').find((card) => card.id !== CORE.id)!;

const HEADER = 'Set Number,Card Number,Variant,Count,Name,Color,Rarity';
const row = (set: string, number: string, variant: string, count: number, name: string) =>
  `${set},${number},${variant},${count},"${name}",Amber,Common`;

/**
 * A small Dreamborn export, with Windows line endings as the site writes them: two finishes of a
 * Core card, a card from before Core, a promo by its code, a row no card answers to, and a zero.
 */
const EXPORT = [
  HEADER,
  row('013', String(CORE.number), 'normal', 2, CORE.fullName),
  row('013', String(CORE.number), 'foil', 1, CORE.fullName),
  row('003', String(OLDER.number), 'normal', 1, OLDER.fullName),
  row('003', `${PROMO.number}/${PROMO.promoGrouping}`, 'foil', 1, PROMO.fullName),
  row('013', '9999', 'normal', 1, 'Nobody - Not a Card'),
  row('013', String(UNOWNED.number), 'normal', 0, UNOWNED.fullName),
].join('\r\n');

/** What the export holds: three cards, five copies. */
const IMPORTED: Entries = {
  [String(CORE.id)]: {normal: 2, foil: 1},
  [String(OLDER.id)]: {normal: 1, foil: 0},
  [String(PROMO.id)]: {normal: 0, foil: 1},
};

const csv = (name: string, text: string) => ({name, mimeType: 'text/csv', buffer: Buffer.from(text)});

const importDialog = (page: Page) => page.getByRole('dialog', {name: 'Import your collection'});

/** Hands the dialog a file once it can read one: the full card list has loaded. */
async function chooseFile(dialog: Locator, file: ReturnType<typeof csv>): Promise<void> {
  await expect(dialog.getByRole('button', {name: 'Choose a CSV file'})).toBeEnabled({timeout: 15000});
  await dialog.getByLabel('Collection CSV file').setInputFiles(file);
}

/** The receipt for {@link EXPORT}. */
async function expectReceipt(dialog: Locator): Promise<void> {
  await expect(dialog.getByRole('heading', {name: 'Collection imported'})).toBeVisible();
  await expect(dialog).toContainText('3 cards, 5 copies in all.');
  await expect(dialog).toContainText('One card could not be matched to our data and was not imported: 13-9999.');
  await expect(dialog.getByRole('alert')).toHaveCount(0);
}

test.describe('Importing a collection', () => {
  test("Browse's Import collection replaces the collection with the file's, and says what came in", async ({
    page,
  }, testInfo) => {
    // The gear sits in the desktop's toolbar.
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    const writes = await signInAsCollector(page, {[String(UNOWNED.id)]: {normal: 1, foil: 0}});
    await page.goto('/browse');
    await signedIn(page);

    const gear = page.getByRole('button', {name: 'Collection actions'});
    await gear.click();
    await page
      .getByRole('menu', {name: 'Collection actions'})
      .getByRole('menuitem', {name: /^Import collection/})
      .click();
    const dialog = importDialog(page);
    await expect(dialog).toContainText('Importing replaces whatever collection Inkweave already has');
    await chooseFile(dialog, csv('dreamborn.csv', EXPORT));

    await expectReceipt(dialog);
    await dialog.getByRole('button', {name: 'Done'}).click();
    await expect(dialog).toHaveCount(0);
    await expect(gear).toBeFocused();
    // The file's three cards, and the card the collection held before gone.
    await expect.poll(() => writes.at(-1)).toEqual(IMPORTED);
  });

  test("the account page's Import collection brings the file's cards in", async ({page}) => {
    const writes = await signInAsCollector(page, null);
    await page.goto('/account');

    await page.getByRole('button', {name: 'Import collection'}).click();
    const dialog = importDialog(page);
    await expect(dialog).not.toContainText('Importing replaces');
    await chooseFile(dialog, csv('dreamborn.csv', EXPORT));

    await expectReceipt(dialog);
    await dialog.getByRole('button', {name: 'Done'}).click();
    await expect(page.getByText('Cards owned', {exact: true}).locator('..')).toHaveText(/^Cards owned\s*3$/);
    await expect.poll(() => writes.at(-1)).toEqual(IMPORTED);
  });

  test('a file with no owned cards is refused, and a good one chosen next comes in', async ({page}) => {
    const writes = await signInAsCollector(page, null);
    await page.goto('/account');
    await page.getByRole('button', {name: 'Import collection'}).click();
    const dialog = importDialog(page);

    await chooseFile(dialog, csv('empty.csv', [HEADER, row('013', String(CORE.number), 'normal', 0, CORE.fullName)].join('\r\n')));
    await expect(dialog.getByRole('alert')).toHaveText(
      'No owned cards were found in that file. Is it a Dreamborn collection export?',
    );
    await expect(dialog.getByRole('heading', {name: 'Import your collection'})).toBeVisible();
    expect(writes).toEqual([]);

    // The good file's upload is the only one: an upload the refused file started would have
    // landed by the time the good one's receipt shows.
    await chooseFile(dialog, csv('dreamborn.csv', EXPORT));
    await expectReceipt(dialog);
    await expect.poll(() => writes).toEqual([IMPORTED]);
  });

  test('a file the browser cannot read is refused, and a readable one chosen next comes in', async ({page}) => {
    await page.addInitScript(() => {
      // The browser's own read failing, as a file moved or deleted after it was picked does.
      const read = Blob.prototype.text;
      Blob.prototype.text = function (this: Blob) {
        if (this instanceof File && this.name === 'unreadable.csv') {
          return Promise.reject(new DOMException('The file could not be read.', 'NotReadableError'));
        }
        return read.call(this);
      };
    });
    const writes = await signInAsCollector(page, null);
    await page.goto('/account');
    await page.getByRole('button', {name: 'Import collection'}).click();
    const dialog = importDialog(page);

    await chooseFile(dialog, csv('unreadable.csv', EXPORT));
    await expect(dialog.getByRole('alert')).toHaveText(
      'That file could not be read. Try exporting it from Dreamborn again.',
    );
    await expect(dialog.getByRole('button', {name: 'Choose a CSV file'})).toBeEnabled();
    expect(writes).toEqual([]);

    await chooseFile(dialog, csv('dreamborn.csv', EXPORT));
    await expectReceipt(dialog);
    await expect.poll(() => writes).toEqual([IMPORTED]);
  });

  test("a card list that won't load offers Try again in place of the file, which brings it back", async ({page}) => {
    let failing = true;
    await page.route('**/data/collection/**', (route) =>
      failing ? route.fulfill({status: 503, body: ''}) : route.continue(),
    );
    await signInAsCollector(page, null);
    await page.goto('/account');
    await page.getByRole('button', {name: 'Import collection'}).click();
    const dialog = importDialog(page);

    // The import must wait for the whole list: parsed against Core alone, a real collection
    // would lose every older card.
    await expect(dialog.getByRole('alert')).toHaveText(/^Could not load the collection \(.*HTTP 503\)\.$/);
    await expect(dialog.getByRole('button', {name: 'Choose a CSV file'})).toHaveCount(0);

    failing = false;
    await dialog.getByRole('button', {name: 'Try again'}).click();
    await expect(dialog.getByRole('button', {name: 'Choose a CSV file'})).toBeEnabled({timeout: 15000});
    await expect(dialog.getByRole('alert')).toHaveCount(0);
  });
});
