/* eslint-disable react-hooks/rules-of-hooks */
import {test as base} from '@playwright/test';
import {AppPage} from '../pages/app.page';
import {CardListPage} from '../pages/card-list.page';
import {SynergyResultsPage} from '../pages/synergy-results.page';
import {VotePage} from '../pages/vote.page';

// Define fixture types
type TestFixtures = {
  appPage: AppPage;
  cardListPage: CardListPage;
  synergyResultsPage: SynergyResultsPage;
  votePage: VotePage;
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
  votePage: async ({page}, use) => {
    const votePage = new VotePage(page);
    await use(votePage);
  },
});

export {expect} from '@playwright/test';
