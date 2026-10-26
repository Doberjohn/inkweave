import {afterEach, beforeEach, describe, it, expect, vi} from 'vitest';
import {act, cleanup, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter, useLocation} from 'react-router-dom';
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
    // The grid, empty with this fixture, shows it, and the page's status line says it.
    expect(screen.getByRole('status')).toHaveTextContent('No cards match your filters.');
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
      // The status line is in the page while the cards load, so screen readers hear it change.
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      await act(async () => deliver([onHumanLegs]));
      expect(screen.getByRole('button', {name: /On Human Legs/})).toBeInTheDocument();
      // The count comes once it has held, so a search typed letter by letter is one message.
      expect(screen.getByRole('status')).toBeEmptyDOMElement();
      await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 card'));
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
    renderPhoneRow: (_listing, {count, onOpen}) => (
      <div data-testid="phone-binder-row">
        <button onClick={onOpen}>{`Binder options ${count}`}</button>
      </div>
    ),
    // A stand-in for the Binder sheet (#969): it names the sort the page handed it, and its Apply
    // goes through the page's one write with what a sheet drafts beside the filters.
    renderPhoneSheet: (_listing, sheet) =>
      sheet.isOpen ? (
        <div role="dialog" aria-label={`Binder sheet, sorted ${sheet.sortOrder}`}>
          <button
            onClick={() =>
              sheet.onApply(
                {inks: ['Amber'], types: [], costs: [], opts: {}},
                {sortOrder: 'name-asc', edit: (params) => params.set('owned', 'missing')},
              )
            }>
            Apply the sheet
          </button>
        </div>
      ) : null,
  };

  /** The URL's params, which the page's writes change. */
  function SearchProbe() {
    return <output data-testid="url-search">{useLocation().search}</output>;
  }

  function renderBody(url = '/browse?binder=3', collection = slots) {
    render(
      <MemoryRouter initialEntries={[url]}>
        <BrowseBody collection={collection} />
        <SearchProbe />
      </MemoryRouter>,
    );
  }

  it('counts a binder click on a card from outside Core in the card analytics', () => {
    renderBody();
    fireEvent.click(screen.getByRole('button', {name: 'binder card'}));
    expect(trackCardSelected).toHaveBeenCalledWith(outside, 'browse');
  });

  it('leaves the status line empty while the binder shows, since it lights slots rather than listing cards', () => {
    renderBody();
    expect(screen.getByTestId('browse-count')).toBeEmptyDOMElement();
  });

  describe("on a phone, the binder's one row (#969)", () => {
    beforeEach(() => {
      vi.stubGlobal('innerWidth', 390);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("stands in for the toolbar and the title, which stays the page's heading for screen readers", () => {
      renderBody();
      expect(screen.getByTestId('phone-binder-row')).toBeInTheDocument();
      expect(screen.queryByTestId('browse-toolbar')).toBeNull();
      const title = screen.getByRole('heading', {level: 1, name: 'Browse Cards'});
      expect(title).toHaveStyle({position: 'absolute', width: '1px', height: '1px', overflow: 'hidden'});
    });

    it('counts the filters on, and Owned or Missing, on Binder options', () => {
      renderBody('/browse?binder=3&ink=Amber,Ruby');
      expect(screen.getByRole('button', {name: 'Binder options 2'})).toBeInTheDocument();
      cleanupAndRender({...slots, show: 'missing'}, '/browse?binder=3&ink=Amber');
      expect(screen.getByRole('button', {name: 'Binder options 2'})).toBeInTheDocument();
    });

    it('opens the Binder sheet in place of the filter sheet, and its Apply writes all it holds at once', async () => {
      renderBody('/browse?binder=3&sort=cost-desc');
      fireEvent.click(screen.getByRole('button', {name: 'Binder options 0'}));
      expect(screen.getByRole('dialog', {name: 'Binder sheet, sorted cost-desc'})).toBeInTheDocument();
      expect(screen.queryByTestId('filter-drawer')).toBeNull();

      fireEvent.click(screen.getByRole('button', {name: 'Apply the sheet'}));

      await waitFor(() =>
        expect(screen.getByTestId('url-search')).toHaveTextContent('?binder=3&sort=name-asc&ink=Amber&owned=missing'),
      );
    });

    it('closes the Binder sheet when the window widens past a phone, rather than swap in the filter dialog', async () => {
      renderBody();
      fireEvent.click(screen.getByRole('button', {name: 'Binder options 0'}));
      expect(screen.getByRole('dialog', {name: /^Binder sheet/})).toBeInTheDocument();

      vi.stubGlobal('innerWidth', 800);
      act(() => {
        window.dispatchEvent(new Event('resize'));
      });

      // useResponsive settles a resize after a debounce.
      await waitFor(() => expect(screen.queryByRole('dialog', {name: /^Binder sheet/})).toBeNull());
      expect(screen.queryByTestId('filter-modal')).toBeNull();
    });

    it('keeps the toolbar, the title and the filter sheet in grid mode', () => {
      const grid = {
        ...slots,
        active: false,
        renderBinder: () => null,
        renderPhoneRow: () => undefined,
        renderPhoneSheet: () => undefined,
      };
      renderBody('/browse', grid);
      expect(screen.getByRole('heading', {level: 1, name: 'Browse Cards'})).not.toHaveStyle({position: 'absolute'});
      fireEvent.click(within(screen.getByTestId('browse-toolbar')).getByRole('button', {name: /filters/i}));
      expect(screen.getByTestId('filter-drawer')).toBeInTheDocument();
    });
  });

  describe('on a tablet', () => {
    beforeEach(() => {
      vi.stubGlobal('innerWidth', 800);
    });
    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('keeps the filter dialog in collection mode, opened from the toolbar', () => {
      renderBody();
      fireEvent.click(within(screen.getByTestId('browse-toolbar')).getByRole('button', {name: /filters/i}));
      expect(screen.getByTestId('filter-modal')).toBeInTheDocument();
    });
  });

  /** A second page in the same test, the first one gone. */
  function cleanupAndRender(collection: BrowseCollectionSlots, url: string) {
    cleanup();
    renderBody(url, collection);
  }
});
