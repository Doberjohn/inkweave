/* eslint-disable react-hooks/rules-of-hooks */
import {test as base} from '@playwright/test';
import {AppPage} from '../pages/app.page';
import {CardListPage} from '../pages/card-list.page';
import {SynergyResultsPage} from '../pages/synergy-results.page';
import {DeckPanelPage} from '../pages/deck-panel.page';

// Define fixture types
type TestFixtures = {
  appPage: AppPage;
  cardListPage: CardListPage;
  synergyResultsPage: SynergyResultsPage;
  deckPanelPage: DeckPanelPage;
};

// Extend base test with custom fixtures
// Note: `use` is Playwright's fixture function, not a React Hook
export const test = base.extend<TestFixtures>({
  appPage: async ({page}, use) => {
    const appPage = new AppPage(page);
    await use(appPage);
  },
  cardListPage: async ({page}, use) => {
    const cardListPage = new CardListPage(page);
    await use(cardListPage);
  },
  synergyResultsPage: async ({page}, use) => {
    const synergyResultsPage = new SynergyResultsPage(page);
    await use(synergyResultsPage);
  },
  deckPanelPage: async ({page}, use) => {
    const deckPanelPage = new DeckPanelPage(page);
    await use(deckPanelPage);
  },
});

export {expect} from '@playwright/test';
