import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {BrowseBody, BrowsePage} from '../BrowsePage';
import {trackCardSelected} from '../../features/cards/lib/cardAnalytics';
import type {BrowseCollectionSlots} from '../../features/collection/useBrowseCollection';
import {createCard} from '../../shared/test-utils';

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
vi.mock('../../features/cards/lib/cardAnalytics', () => ({trackCardSelected: vi.fn()}));

describe('BrowsePage with the collection flag off', () => {
  it('renders the toolbar and grid without a Collection button, and without collection providers', () => {
    render(
      <MemoryRouter initialEntries={['/browse']}>
        <BrowsePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('browse-search')).toBeInTheDocument();
    // The grid, empty with this fixture, says so in its status line.
    expect(screen.getByText('No cards match your filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Show my collection'})).not.toBeInTheDocument();
  });
});

describe('BrowseBody with collection mode on', () => {
  /** A binder card from set 3, which Core's `CardDataContext` (mocked empty here) cannot resolve. */
  const outside = createCard({id: 'set3-101', name: 'Outside Card', fullName: 'Outside Card - Set Three', setCode: '3'});
  const slots: BrowseCollectionSlots = {
    active: true,
    pool: [outside],
    modeSwitch: null,
    renderBinder: (_listing, onCardSelect) => <button onClick={() => onCardSelect(outside)}>binder card</button>,
    modeActions: null,
    modalTarget: null,
    sortOptions: undefined,
    show: 'all',
    rarityOptions: () => [],
    promoOnly: false,
    owns: () => true,
    kept: new Set(),
    prompts: null,
    renderSetPanel: () => undefined,
    renderSetPicker: () => undefined,
  };

  it('counts a binder click on a card from outside Core in the card analytics', () => {
    render(
      <MemoryRouter initialEntries={['/browse?binder=3']}>
        <BrowseBody collection={slots} />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'binder card'}));
    expect(trackCardSelected).toHaveBeenCalledWith(outside, 'browse');
  });
});
