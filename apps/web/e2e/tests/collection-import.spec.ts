import fs from 'node:fs';
import path from 'node:path';
import type {Locator, Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {signedIn, signInAsCollector, type Entries} from '../helpers/collector';

/**
 * Importing a Dreamborn collection export (#553): the file goes through the CSV parser against
 * the whole card list, the dialog's receipt says what came in and what didn't, and the
 * collection goes to the account. Signed in as `collection-mode.spec.ts` is (`signInAsCollector`),
 * whose route keeps each collection the page uploads.
 */

interface ChunkCard {
  id: number | string;
  fullName: string;
  number: number;
}

interface ChunkPromo {
  id: number;
  number: number;
  promoGrouping: string;
  fullName: string;
  finish?: string;
  artVariant?: string;
}

const readData = <T,>(file: string): T =>
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'public/data', file), 'utf8')) as T;

const coreSet = readData<{cards: (ChunkCard & {setCode: string})[]}>('allCards.json').cards.filter(
  (card) => card.setCode === '13',
);
const set3 = readData<ChunkCard[]>('collection/3.json');
const promos = readData<ChunkPromo[]>('collection/promos.json');

/** A card whose `set:number` no other card of its set shares, so its row names it alone. */
function aloneAtItsNumber<T extends {number: number}>(cards: T[]): T {
  const card = cards.find((c) => c.number > 10 && cards.filter((other) => other.number === c.number).length === 1);
  if (!card) throw new Error('Fixture broken: no card stands alone at its number');
  return card;
}

const CORE = aloneAtItsNumber(coreSet);
const OLDER = aloneAtItsNumber(set3);
/** A promo its code and number name alone, with no art letter or finish to tell twins apart. */
const PROMO = (() => {
  const promo = promos.find(
    (p) =>
      !p.finish &&
      !p.artVariant &&
      promos.filter((other) => other.promoGrouping === p.promoGrouping && other.number === p.number).length === 1,
  );
  if (!promo) throw new Error('Fixture broken: no promo stands alone at its code');
  return promo;
})();
/** A card the export lists with no copies: a census row, as every row of a real export is. */
const UNOWNED = coreSet.find((card) => card !== CORE)!;

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
    await page.getByRole('menu', {name: 'Collection actions'}).getByRole('menuitem', {name: /^Import collection/}).click();
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
    await expect(page.getByText('Cards owned', {exact: true}).locator('..')).toContainText('3');
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

    await chooseFile(dialog, csv('dreamborn.csv', EXPORT));
    await expectReceipt(dialog);
    await expect.poll(() => writes.at(-1)).toEqual(IMPORTED);
  });

  test('a file the browser cannot read is refused', async ({page}) => {
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
