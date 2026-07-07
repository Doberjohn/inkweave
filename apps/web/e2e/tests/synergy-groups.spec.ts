import {test, expect} from '../fixtures';
import fs from 'node:fs';
import path from 'node:path';

// Daisy Duck - Musketeer Spy: shift-targets (direct) + discard (playstyle). Discard is large enough
// to be truncated in the modal's default state, so it renders a "+N more" tile. Group sizes are
// read from the precomputed synergy data so the fixture survives Set 12+ pool drift.
const CARD_URL = '/card/1947';
const CARD_ID = '1947';

interface SynergyGroup {
  groupKey: string;
  synergies: unknown[];
}
interface SynergyData {
  groups: SynergyGroup[];
}
const synergyData: SynergyData = JSON.parse(
  fs.readFileSync(path.resolve(process.cwd(), 'public/data/synergies', `${CARD_ID}.json`), 'utf8'),
);
// Coalesce `groups` once so a malformed JSON (missing `groups`) consistently falls through to
// the custom fixture error below, rather than a cryptic TypeError at one unguarded access.
const groups = synergyData.groups ?? [];
const discardGroup = groups.find((g) => g.groupKey === 'discard');
if (!discardGroup || discardGroup.synergies.length <= 3 || groups.length < 2) {
  throw new Error(
    `Fixture broken: card ${CARD_ID} must have 2+ synergy groups including a 'discard' group ` +
      `with >3 synergies (a truncated group with a "+N more" tile). Is the card still in the pool?`,
  );
}

/**
 * Default-mode CardOverviewModal interactions — chip filtering and "+N more" expansion. Both set
 * `activeGroupFilter`, switching the modal into the focused single-group state
 * (`data-state="focused"`). Replaces this file's pre-#320 card-detail-page tests, which were
 * `describe.skip`'d after the modal redesign removed the route-rendered synergy sidebar.
 */
test.describe('Synergy groups — modal default mode (desktop)', () => {
  test.beforeEach(async ({page, appPage}, testInfo) => {
    if (testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_URL);
    await appPage.cardOverviewModal.waitFor({state: 'visible', timeout: 10000});
    await expect(appPage.cardOverviewModal.locator('[data-group-key]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('a group chip toggles the modal between focused and default', async ({appPage}) => {
    const modal = appPage.cardOverviewModal;
    expect(await modal.locator('[data-group-key]').count()).toBeGreaterThan(1);
    await expect(modal).toHaveAttribute('data-state', 'default');

    // Filter chips are the only buttons carrying aria-pressed.
    const discardChip = modal.locator('button[aria-pressed]').filter({hasText: 'Discard'});
    await discardChip.click();

    // Focused: only the discard group remains and the chip reads pressed.
    await expect(modal).toHaveAttribute('data-state', 'focused');
    await expect(discardChip).toHaveAttribute('aria-pressed', 'true');
    await expect(modal.locator('[data-group-key]')).toHaveCount(1);
    await expect(modal.locator('[data-group-key="discard"]')).toBeVisible();

    // Clicking the active chip again clears the filter.
    await discardChip.click();
    await expect(modal).toHaveAttribute('data-state', 'default');
    expect(await modal.locator('[data-group-key]').count()).toBeGreaterThan(1);
  });

  test('the "+N more" tile expands its group', async ({appPage}) => {
    const modal = appPage.cardOverviewModal;
    const moreTile = modal.locator('[data-group-key="discard"] [data-testid="more-tile"]');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    // Expanding routes through the same activeGroupFilter → focused single-group view.
    await expect(modal).toHaveAttribute('data-state', 'focused');
    await expect(modal.locator('[data-group-key]')).toHaveCount(1);
    await expect(modal.locator('[data-group-key="discard"]')).toBeVisible();
  });
});

test.describe('Synergy groups — modal default mode (mobile)', () => {
  test.beforeEach(async ({page, appPage}, testInfo) => {
    if (!testInfo.project.name.startsWith('mobile-')) test.skip();
    await page.goto(CARD_URL);
    await appPage.cardOverviewModal.waitFor({state: 'visible', timeout: 10000});
    await expect(appPage.cardOverviewModal.locator('[data-group-key]').first()).toBeVisible({
      timeout: 10000,
    });
  });

  test('a group chip filters the modal to that group', async ({appPage}) => {
    const modal = appPage.cardOverviewModal;
    expect(await modal.locator('[data-group-key]').count()).toBeGreaterThan(1);

    const discardChip = modal.locator('button[aria-pressed]').filter({hasText: 'Discard'});
    await discardChip.click();

    await expect(modal).toHaveAttribute('data-state', 'focused');
    await expect(modal.locator('[data-group-key]')).toHaveCount(1);
    await expect(modal.locator('[data-group-key="discard"]')).toBeVisible();
  });

  test('the "+N more" tile expands its group', async ({appPage}) => {
    const modal = appPage.cardOverviewModal;
    const moreTile = modal.locator('[data-group-key="discard"] [data-testid="more-tile"]');
    await expect(moreTile).toBeVisible();
    await moreTile.click();

    await expect(modal).toHaveAttribute('data-state', 'focused');
    await expect(modal.locator('[data-group-key]')).toHaveCount(1);
  });
});
