import {test, expect} from '../fixtures';

/**
 * Terminal-state guard for the in-depth vote page (`/vote/:a/:b`, reached via
 * "Rate in Detail").
 *
 * The existing page-shell-loading test only asserts the *loading skeleton*
 * appears — a state a stuck/looping page (e.g. the #403 render loop) mimics
 * perfectly, so it passed a broken page. This asserts the *loaded* state: the
 * skeleton gives way to an interactive form. A page that never leaves loading
 * (loop, hang) fails here by timeout, and the fixture's console guard
 * independently fails on the render-loop's "Maximum update depth exceeded".
 *
 * 2730 / 2718 is a real, synergistic pair (Woody - Jungle Guide ↔ Woody -
 * Waiting for a Friend); rendering the form needs only local synergy data, no
 * Supabase, so this stays off the live-backend flake path.
 */
test.describe('In-depth vote page', () => {
  test('loads the pair and renders the interactive vote form', async ({page}) => {
    await page.goto('/vote/2730/2718');

    // The loading skeleton must resolve — its <main> carries this aria-label only
    // while loading, so "hidden" means the page reached its terminal state.
    await expect(page.getByRole('main', {name: 'Loading vote pair and form'})).toBeHidden({
      timeout: 15000,
    });

    // Terminal state: the form's first dimension + its answer controls are live.
    await expect(page.getByText('Is this synergy real?')).toBeVisible();
    await expect(page.getByRole('radio', {name: 'Yes'})).toBeVisible();
  });
});
