import type {ReactNode} from 'react';
import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
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
const fixtures = vi.hoisted(() => ({
  coreCards: [] as LorcanaCard[],
  openCardModal: vi.fn(),
  loadPreCoreSearchCards: vi.fn(),
  chunksImported: false,
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({
    cards: fixtures.coreCards,
    isLoading: false,
    error: null,
    retryLoad: vi.fn(),
    uniqueKeywords: [],
    uniqueClassifications: [],
    sets: [],
    getCardById: (id: string) => fixtures.coreCards.find((card) => card.id === id),
  }),
}));
vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({openCardModal: fixtures.openCardModal}),
}));
// Browse's search loads sets 1-8 from here (#911). The factory runs when the module is first
// imported, so a static import from Browse would run it as this file loads.
vi.mock('../../features/collection/collectionChunks', () => {
  fixtures.chunksImported = true;
  return {loadPreCoreSearchCards: fixtures.loadPreCoreSearchCards};
});
// jsdom lays nothing out, so the real grid renders no tiles: this one renders them all.
vi.mock('react-virtuoso', async () => {
  const {createElement, Fragment} = await import('react');
  return {
    VirtuosoGrid: ({totalCount, itemContent}: {totalCount: number; itemContent: (index: number) => ReactNode}) =>
      createElement(Fragment, null, ...Array.from({length: totalCount}, (_, index) => itemContent(index))),
  };
});
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {...actual, CompactHeader: () => <header data-testid="compact-header" />};
});
vi.mock('../../features/cards/lib/cardAnalytics', () => ({trackCardSelected: vi.fn()}));

// Lets a mocked dynamic import settle.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('BrowsePage with the collection flag off', () => {
  it('renders the toolbar and grid without a Collection button, and without collection providers', async () => {
    fixtures.loadPreCoreSearchCards.mockClear();
    render(
      <MemoryRouter initialEntries={['/browse']}>
        <BrowsePage />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('browse-search')).toBeInTheDocument();
    // The grid, empty with this fixture, says so in its status line.
    expect(screen.getByText('No cards match your filters.')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Show my collection'})).not.toBeInTheDocument();
    // Sets 1-8 wait for a search (#911), and so does their loader's module, which Browse
    // imports dynamically so as not to ship collection mode's data layer to every visitor.
    await flush();
    expect(fixtures.loadPreCoreSearchCards).not.toHaveBeenCalled();
    expect(fixtures.chunksImported).toBe(false);
  });

  describe('search over sets 1-8 (#911)', () => {
    const singing = createCard({id: '1951', name: 'Ariel', fullName: 'Ariel - Singing Mermaid', setCode: '9'});
    const onHumanLegs = createCard({id: '1', name: 'Ariel', fullName: 'Ariel - On Human Legs', setCode: '1'});
    // The search keeps its cards at module level for the visit, so each test renders a fresh page.
    let FreshBrowsePage: typeof BrowsePage;
    const renderAt = (url: string) =>
      render(
        <MemoryRouter initialEntries={[url]}>
          <FreshBrowsePage />
        </MemoryRouter>,
      );

    beforeEach(async () => {
      fixtures.coreCards = [singing];
      fixtures.openCardModal.mockClear();
      fixtures.loadPreCoreSearchCards.mockReset();
      vi.resetModules();
      ({BrowsePage: FreshBrowsePage} = await import('../BrowsePage'));
    });

    afterEach(() => {
      fixtures.coreCards = [];
    });

    it('lists a sets 1-8 Ariel beside the Core one, as a button that opens the card window', async () => {
      fixtures.loadPreCoreSearchCards.mockResolvedValue([onHumanLegs]);
      renderAt('/browse?q=ariel');

      // A sets 1-8 card has no page to link to.
      fireEvent.click(await screen.findByRole('button', {name: /On Human Legs/}));
      expect(screen.getByRole('link', {name: /Singing Mermaid/})).toHaveAttribute(
        'href',
        '/card/1951/ariel-singing-mermaid',
      );
      const [cardId, siblingIds, options] = fixtures.openCardModal.mock.calls[0];
      expect(cardId).toBe('1');
      expect([...siblingIds].sort()).toEqual(['1', '1951']);
      expect(options.resolveCard('1')).toBe(onHumanLegs);
    });

    it('shows the loading grid, not "No cards match", while a search only sets 1-8 match waits for them', async () => {
      let deliver!: (cards: LorcanaCard[]) => void;
      fixtures.loadPreCoreSearchCards.mockReturnValue(new Promise((resolve) => (deliver = resolve)));
      renderAt('/browse?q=human+legs');

      await waitFor(() => expect(fixtures.loadPreCoreSearchCards).toHaveBeenCalled());
      expect(screen.getByLabelText('Loading cards')).toBeInTheDocument();
      expect(screen.queryByText('No cards match your filters.')).not.toBeInTheDocument();
      await act(async () => deliver([onHumanLegs]));
      expect(screen.getByRole('button', {name: /On Human Legs/})).toBeInTheDocument();
    });
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
