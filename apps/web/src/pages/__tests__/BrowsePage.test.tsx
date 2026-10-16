import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {BrowsePage} from '../BrowsePage';

/*
 * The FLAG-OFF page, which production ships until collection launches (#553 Phase C),
 * and which no E2E test covers: playwright.config.ts pins the flag on, so the router
 * serves BrowseCollectionPage there. No collection provider is mounted below: if this
 * page or BrowseBody came to call a collection hook, this render would throw, and the
 * flag-off page would need providers that only mount under the flag.
 */
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({
    cards: [],
    isLoading: false,
    error: null,
    retryLoad: vi.fn(),
    uniqueKeywords: [],
    uniqueClassifications: [],
    sets: [],
    getCardById: () => undefined,
  }),
}));
vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({openCardModal: vi.fn()}),
}));
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {...actual, CompactHeader: () => <header data-testid="compact-header" />};
});

describe('BrowsePage with the collection flag off', () => {
  it('renders the toolbar and grid without a Collection button, and without collection providers', () => {
    render(
      <MemoryRouter initialEntries={['/browse']}>
        <BrowsePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('browse-search')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Show my collection'})).not.toBeInTheDocument();
  });
});
