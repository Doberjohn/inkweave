import type {Page} from '@playwright/test';
import {test, expect} from '../fixtures';
import {DeckBackend, LEGAL_60_DECKLIST, TEST_USER_ID, signInAs} from '../helpers/deckBackend';

/**
 * The #473 acceptance flow, end to end:
 *   build -> 60 cards -> legality green -> save signed in -> the link opens for a stranger.
 *
 * This is the first coverage of the deck SAVE WRITE path. Everything before it
 * asserted rendering and reads, so a save that silently failed would have left
 * the whole suite green. See `helpers/deckBackend.ts` for what is stubbed and,
 * more importantly, for what these specs therefore do NOT prove.
 *
 * Owner ruling 2026-08-05: there is no publish button. Visibility is chosen when
 * the deck is created and reaches the row on the next Save, or changed later by
 * the visibility control. Copying a link never publishes; on a private deck it
 * refuses, because that link resolves to nothing for anyone else.
 *
 * Desktop only. `DeckBuilderPage` renders a "not on mobile" notice instead of the
 * builder, so there is nothing here to drive on a phone; the mobile half of
 * /decks is covered in navigation.spec.ts.
 */

/** Import a Core-legal 60 through the real dialog, and wait for legality to go green. */
async function importLegal60(page: Page): Promise<void> {
  await page.getByRole('button', {name: 'Import', exact: true}).click();
  await page.getByRole('textbox', {name: 'Decklist to import'}).fill(LEGAL_60_DECKLIST);
  // The dialog's own Import button, not the toolbar's behind it.
  await page.getByRole('dialog').getByRole('button', {name: 'Import', exact: true}).click();

  // The Duels button losing its "must be Core legal" label IS the legality signal:
  // it is gated on DeckStats.isLegal, so this covers the 60-card, 4-copy and
  // 2-ink rules at once without reaching into state.
  await expect(page.getByRole('button', {name: 'Play on Duels'})).toBeEnabled({timeout: 15000});
}

/**
 * Press Save and wait for it to rest.
 *
 * A disabled Save carries its reason in `aria-label`, which REPLACES "Save" as
 * the accessible name, so "No changes to save" is the button saying the cloud
 * copy now matches.
 */
async function saveDeck(page: Page): Promise<void> {
  const save = page.getByRole('button', {name: 'Save', exact: true});
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page.getByRole('button', {name: 'No changes to save'})).toBeVisible({timeout: 15000});
}

/** Start a new deck from /decks, choosing its visibility in the dialog. */
async function createDeck(page: Page, visibility: 'Private' | 'Public'): Promise<void> {
  await page.goto('/decks');
  await page.getByRole('button', {name: '+ New deck'}).click();
  const dialog = page.getByRole('dialog');
  // The radio's accessible name is `${title}. ${description}`, so anchor on the title.
  await dialog.getByRole('radio', {name: new RegExp(`^${visibility}\\.`)}).check();
  await dialog.getByRole('button', {name: 'Build a new deck'}).click();
  await expect(page).toHaveURL(/\/decks\/new$/);
}

test.describe('Deck save and share', () => {
  test('a deck created public is live for a stranger as soon as it is saved', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const backend = new DeckBackend();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);

    await createDeck(page, 'Public');
    await importLegal60(page);
    await saveDeck(page);

    await expect
      .poll(() => backend.rows.size, {timeout: 15000, message: 'deck never reached the backend'})
      .toBe(1);

    const saved = backend.all()[0];
    expect(saved.owner_id).toBe(TEST_USER_ID);
    expect(saved.cards.reduce((total, card) => total + card.quantity, 0)).toBe(60);
    // The whole ruling in one assertion: choosing public and saving IS publishing.
    // No second step ran between createDeck and saveDeck.
    expect(saved.is_public).toBe(true);

    // The owner's own view of it. Copy link is gone (owner ruling 2026-08-07), so
    // Edit is what distinguishes owner from visitor here.
    await page.goto(`/decks/${saved.id}`);
    await expect(page.getByRole('link', {name: 'Edit deck'})).toBeVisible({timeout: 15000});

    // And a stranger, in a genuinely separate context with no session, can open it.
    const anon = await browser.newContext();
    await backend.attach(anon, null);
    const stranger = await anon.newPage();
    await stranger.goto(`/decks/${saved.id}`);

    // Asserted on the card total rather than the deck name: a fresh draft's name
    // is a default this spec should not pin, but 60 cards had to survive the trip.
    await expect(stranger.getByRole('heading', {level: 1})).toBeVisible({timeout: 15000});
    await expect(stranger.getByText('60 cards')).toBeVisible();
    // Reading someone's deck is not owning it. Asserted on Edit rather than the old
    // "Deck owner controls" region, which no longer exists — a toHaveCount(0) against
    // a deleted element passes for the wrong reason and proves nothing.
    await expect(stranger.getByRole('link', {name: 'Edit deck'})).toHaveCount(0);
    await anon.close();
  });

  test('a private deck is invisible to strangers until the builder makes it public', async ({
    page,
    context,
    browser,
  }, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    const backend = new DeckBackend();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);

    await createDeck(page, 'Private');
    await importLegal60(page);
    await saveDeck(page);

    const saved = backend.all()[0];
    expect(saved.is_public).toBe(false);

    await page.goto(`/decks/${saved.id}`);

    // The deck loads for its owner. What it no longer carries is any way to share
    // it — Copy link was deleted (owner ruling 2026-08-07), so the guard against
    // handing out a private link is now that the affordance does not exist at all.
    await expect(page.getByRole('heading', {level: 1})).toBeVisible({timeout: 15000});
    await expect(page.getByRole('button', {name: /copy link/i})).toHaveCount(0);

    // Proven before publishing, so the assertion after it means something: the
    // mock enforces `is_public or auth.uid() = owner_id`, exactly as RLS does.
    const anonBefore = await browser.newContext();
    await backend.attach(anonBefore, null);
    const strangerEarly = await anonBefore.newPage();
    await strangerEarly.goto(`/decks/${saved.id}`);
    await expect(strangerEarly.getByText(/not found/i)).toBeVisible({timeout: 15000});
    await anonBefore.close();

    // The deck page cannot change visibility at all any more (owner ruling
    // 2026-08-05): it is a property of the deck, so it changes where the deck is
    // edited, and it saves itself.
    await expect(page.getByRole('button', {name: 'Publish deck'})).toHaveCount(0);
    await page.getByRole('link', {name: 'Edit deck'}).click();
    await page.getByRole('group', {name: 'Deck visibility'}).getByRole('button', {name: 'Public'}).click();

    // NO Save press. Changing who can see a deck is one decision, not two, so the
    // flip writes on its own. Save still owns the write, which is what stops a
    // later Save from putting the old value back.
    await expect.poll(() => backend.rows.get(saved.id)?.is_public, {timeout: 15000}).toBe(true);
    await expect(page.getByRole('button', {name: 'No changes to save'})).toBeVisible({timeout: 15000});


    const anon = await browser.newContext();
    await backend.attach(anon, null);
    const stranger = await anon.newPage();
    await stranger.goto(`/decks/${saved.id}`);
    await expect(stranger.getByText('60 cards')).toBeVisible({timeout: 15000});
    await anon.close();
  });

  test('saving a later edit does not quietly un-publish the deck', async ({page, context}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // Regression guard for a REPRODUCED bug (2026-08-05). Visibility used to be
    // written straight to the row by the deck page while the builder held its own
    // stale copy, so publishing and then saving any edit wrote `is_public: false`
    // back over it, silently, and dropped the deck out of community decks. One
    // value in the draft with Save as the only writer makes that unreachable, and
    // this test is what says so.
    const backend = new DeckBackend();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);

    await createDeck(page, 'Public');
    await importLegal60(page);
    await saveDeck(page);

    const saved = backend.all()[0];
    expect(saved.is_public).toBe(true);

    // Leave the builder, come back through the deck page, and edit.
    await page.goto(`/decks/${saved.id}`);
    await page.getByRole('link', {name: 'Edit deck'}).click();
    await page.getByRole('button', {name: 'Remove one copy of Aurora - Holding Court'}).click();
    await saveDeck(page);

    expect(backend.rows.get(saved.id)?.is_public).toBe(true);
  });

  test('an unsaved deck is not written to the cloud on its own', async ({page, context}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();

    // The counterpart to the save assertions above. useFirstSignInMigration upserts
    // a non-empty draft the moment a uid appears, which is correct on FIRST sign-in
    // and wrong on every later one. alreadyMigrated (the default) is the steady
    // state, and this proves nothing writes until the user asks.
    const backend = new DeckBackend();
    await signInAs(context);
    await backend.attach(context, TEST_USER_ID);

    await page.goto('/decks/new');
    await importLegal60(page);

    // Save is live, which is the point: there IS unsaved work, and it stayed local.
    await expect(page.getByRole('button', {name: 'Save', exact: true})).toBeEnabled();
    expect(backend.rows.size).toBe(0);
  });
});
