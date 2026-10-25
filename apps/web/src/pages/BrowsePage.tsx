import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {CardPrinting, LorcanaCard} from 'inkweave-synergy-engine';
import {BrowseCardGrid, BrowseToolbar} from '../features/cards';
import {
  BROWSE_GUTTER,
  BrowseSidePanel,
  DockedPanelsRow,
  DockedSetPanel,
  useSidePanelDocked,
} from '../features/cards/components/BrowseSidePanel';
import {
  CompactHeader,
  CtaButton,
  ErrorBoundary,
  EtherealBackground,
  FilterDialog,
  MOBILE_NAV_HEIGHT,
  Seo,
} from '../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive, useFilterParams} from '../shared/hooks';
import type {BrowseCollectionSlots, BrowseListing} from '../features/collection/useBrowseCollection';
import {browseView, gridModalTarget, printingIdsFor, tilePrintingFor} from './browseView';
import {usePreCoreSearchCards} from './preCoreSearch';

// =====================================================================
// Subcomponents — local to this file. Keep BrowsePage's render small
// and unduplicated across mobile/desktop branches.
// =====================================================================

function BrowseSeo() {
  return (
    <Seo
      title="Browse Disney Lorcana Cards | Inkweave"
      description="Browse and search every Disney Lorcana Core-format card by ink, cost, type, and keyword. Open any card for its strongest synergies and combos."
      canonicalPath="/browse"
    />
  );
}

function BrowsePageError({onRetry}: {onRetry: () => void}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        gap: 16,
        fontFamily: FONTS.body,
        background: COLORS.background,
      }}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
        Failed to load card data.
      </p>
      <CtaButton onClick={onRetry}>Retry</CtaButton>
    </main>
  );
}

interface BrowseContentSectionProps {
  isMobile: boolean;
  toolbarProps: React.ComponentProps<typeof BrowseToolbar>;
  cards: LorcanaCard[];
  isLoading: boolean;
  onCardSelect: (card: LorcanaCard) => void;
  /** The printing a grid tile shows instead of its card's own art (a picked Enchanted, say). */
  printingFor?: (card: LorcanaCard) => CardPrinting | undefined;
  /** Whether a grid tile's card has a page to link to: a sets 1-8 card in search results has none (#911). */
  hasCardPage?: (card: LorcanaCard) => boolean;
  /** Collection mode's content. When set, it replaces the grid entirely. */
  binder?: React.ReactNode;
  /** The docked filters panel (desktop, while open), left of the grid or binder. */
  sidePanel?: React.ReactNode;
  /** Collection mode's docked set panel (desktop), right of the binder, under Collection. */
  setPanel?: React.ReactNode;
}

function BrowseContentSection({
  isMobile,
  toolbarProps,
  cards,
  isLoading,
  onCardSelect,
  printingFor,
  hasCardPage,
  binder,
  sidePanel,
  setPanel,
}: BrowseContentSectionProps) {
  const titlePadding = isMobile
    ? `${SPACING.lg}px ${SPACING.lg}px 0`
    : `${SPACING.xxl}px ${BROWSE_GUTTER}px 0`;
  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        minHeight: 0,
        position: 'relative',
        zIndex: 1,
      }}>
      <h1
        style={{
          padding: titlePadding,
          fontSize: `${FONT_SIZES.xxl}px`,
          fontWeight: 700,
          color: COLORS.text,
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flexShrink: 0,
        }}>
        Browse Cards
      </h1>
      {/* The toolbar serves BOTH modes: in collection mode its filters decide which
          binder slots stay lit rather than which cards are listed. */}
      <BrowseToolbar {...toolbarProps} />
      {/* Card grid or binder between the docked panels; the grid scrolls inside. */}
      <DockedPanelsRow left={sidePanel} right={setPanel}>
        <ErrorBoundary>
          {binder ?? (
            <BrowseCardGrid
              cards={cards}
              isLoading={isLoading}
              onCardSelect={onCardSelect}
              printingFor={printingFor}
              hasCardPage={hasCardPage}
            />
          )}
        </ErrorBoundary>
      </DockedPanelsRow>
    </div>
  );
}

/** The grid's listing, with how the card window opens each of its cards. */
type GridListing = BrowseListing & {
  printingFor: (cardId: string) => string | undefined;
  /** The sets 1-8 cards a search lists (#911), which CardDataContext cannot resolve. */
  resolveCard: (cardId: string) => LorcanaCard | undefined;
};

/**
 * Open a card from Browse. The binder holds cards CardDataContext cannot resolve,
 * in pockets of its own, so while it shows it says how to open a card and which
 * cards the modal's arrows step through; otherwise the arrows follow the grid, and
 * each tile opens on the printing it shows, a promo tile its card on that promo.
 */
function openFromBrowse(
  openCardModal: ReturnType<typeof useCardModal>['openCardModal'],
  cardId: string,
  listing: GridListing,
  collection: BrowseCollectionSlots | null,
) {
  const target =
    collection?.modalTarget?.(cardId, listing) ??
    gridModalTarget(cardId, listing.cards, listing.printingFor, listing.resolveCard);
  openCardModal(target.cardId, target.siblingIds, target.options);
}

/**
 * The docked filters panel's state (desktop): OPEN BY DEFAULT (owner, 2026-10-07), and
 * the Filters button closes and reopens it. Collection mode's set panel has a place of
 * its own on the right (owner, 2026-10-08), so the filters panel holds nothing else.
 */
function useSidePanelState() {
  const [open, setOpen] = useState(true);
  return {open, onFiltersClick: () => setOpen((wasOpen) => !wasOpen)};
}

/**
 * The viewport-bounded shell, one definition for both widths. The two differed
 * only in height (mobile subtracts the bottom nav, so AppLayout's padding does not
 * push past the viewport and bring back page scroll) and in the filter dialog's
 * variant; as two literal returns every shell change had to be made twice.
 */
function BrowseShell({
  isMobile,
  goHome,
  contentProps,
  filterDialogProps,
  prompts,
}: {
  isMobile: boolean;
  goHome: () => void;
  contentProps: React.ComponentProps<typeof BrowseContentSection>;
  filterDialogProps: Omit<React.ComponentProps<typeof FilterDialog>, 'variant'>;
  prompts: React.ReactNode;
}) {
  return (
    <main
      style={{
        height: isMobile ? `calc(100dvh - ${MOBILE_NAV_HEIGHT}px)` : '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
        overflow: 'hidden',
      }}>
      <BrowseSeo />
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} isMobile={isMobile} />
      <BrowseContentSection {...contentProps} />
      <FilterDialog {...filterDialogProps} variant={isMobile ? 'drawer' : 'modal'} />
      {prompts}
    </main>
  );
}

// =====================================================================
// Page component — viewport-bounded shell + shared content section.
// Mobile subtracts the bottom-nav height so AppLayout's padding-bottom
// doesn't push us past the viewport (would re-introduce page scroll).
// =====================================================================

/**
 * Browse without collection mode: the route's page while `SHOW_COLLECTION` is off.
 * With the flag on, the router loads `BrowseCollectionPage` instead, which wires the
 * collection into the same `BrowseBody`. Two page modules rather than one choosing a
 * branch (#553 Phase C): any static path from this module into the collection feature
 * put its data layer on Browse for every visitor, flag off. A chunk of React components
 * runs its runtimes' CommonJS initialisers, so the bundler can never prove it free of
 * side effects, and keeps even an import whose every binding it dropped.
 */
export function BrowsePage() {
  return <BrowseBody collection={null} />;
}

/** Focus the search box when Browse opens with `?focus=search` (desktop only; mobile uses the bottom sheet). */
function useFocusSearchParam(isMobile: boolean) {
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (!isMobile && searchParams.get('focus') === 'search') {
      requestAnimationFrame(() => {
        const input = document.querySelector<HTMLInputElement>('[data-testid="browse-search"]');
        input?.focus();
      });
      searchParams.delete('focus');
      setSearchParams(searchParams, {replace: true});
    }
  }, [isMobile, searchParams, setSearchParams]);
}

type FilterParams = ReturnType<typeof useFilterParams>;
type SidePanelState = ReturnType<typeof useSidePanelState>;
type ToolbarProps = React.ComponentProps<typeof BrowseToolbar>;

/** The Filters button: on desktop it shows or hides the docked panel, elsewhere it opens the dialog. */
function filtersButton(docked: boolean, panel: SidePanelState, openDialog: () => void) {
  return docked
    ? {onFiltersClick: panel.onFiltersClick, docked: {panelOpen: panel.open}}
    : {onFiltersClick: openDialog, docked: undefined};
}

/** The toolbar's props: the URL's filter state and setters, plus the page's own controls. */
function toolbarPropsFrom(
  params: FilterParams,
  controls: Pick<
    ToolbarProps,
    'onFiltersClick' | 'docked' | 'isMobile' | 'modeSwitch' | 'modeActions' | 'setPicker' | 'sortOptions' | 'rarities'
  >,
): ToolbarProps {
  return {
    ...controls,
    // The row under the toolbar holds the room below it, the grid inside its scroller (`BROWSE_ROW_TOP`).
    flushBottom: true,
    activeFilterCount: params.activeFilterCount,
    inkFilters: params.inkFilters,
    typeFilters: params.typeFilters,
    costFilters: params.costFilters,
    filters: params.filters,
    onToggleInk: params.toggleInk,
    onToggleType: params.toggleType,
    onToggleCost: params.toggleCost,
    onClearCosts: params.clearCosts,
    onFiltersChange: params.setFilters,
    sortOrder: params.sortOrder,
    onSortChange: params.setSortOrder,
    searchQuery: params.searchQuery,
    onSearchChange: params.setSearchQuery,
  };
}

/** The docked filters panel, on desktop while open. Live, unlike the dialog's draft: the grid beside it is the preview. */
function dockedPanel(docked: boolean, panel: SidePanelState, props: React.ComponentProps<typeof BrowseSidePanel>) {
  if (!docked || !panel.open) return undefined;
  return <BrowseSidePanel {...props} />;
}

/** Collection mode's set panel, docked on the binder's right where the page docks panels. */
function dockedSetPanel(docked: boolean, setPanel: React.ReactNode | undefined) {
  return docked && setPanel ? <DockedSetPanel>{setPanel}</DockedSetPanel> : undefined;
}

/**
 * Collection mode's parts of the toolbar: Collection, the collection's actions after it, the
 * binder's sort names, and, where the set panel docks, its set picker beside Collection (owner,
 * 2026-10-20).
 */
function collectionToolbar(docked: boolean, collection: BrowseCollectionSlots | null, listing: BrowseListing) {
  return {
    modeSwitch: collection?.modeSwitch,
    modeActions: collection?.modeActions,
    setPicker: docked ? collection?.renderSetPicker(listing) : undefined,
    sortOptions: collection?.sortOptions,
  };
}

/**
 * The sets 1-8 cards Browse's search lists beside Core's (#911), outside the binder, whose pool
 * holds them already: the cards, lookups over both lists, and whether a tile's card has a page.
 */
function useSearchCards(
  searchQuery: string,
  binderShows: boolean,
  getCardById: (id: string) => LorcanaCard | undefined,
) {
  const preCore = usePreCoreSearchCards(searchQuery.trim() !== '' && !binderShows);
  return {
    cards: preCore.cards,
    isLoading: preCore.isLoading,
    findCard: (id: string) => getCardById(id) ?? preCore.byId.get(id),
    resolveCard: (id: string) => preCore.byId.get(id),
    hasCardPage: (card: LorcanaCard) => getCardById(card.baseId ?? card.id) !== undefined,
  };
}

/** Browse's content, with collection mode's slots when the page wires them in (`BrowseCollectionPage`). */
export function BrowseBody({collection}: {collection: BrowseCollectionSlots | null}) {
  const {openCardModal} = useCardModal();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets, getCardById} =
    useCardDataContext();
  const params = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);
  const docked = useSidePanelDocked();
  const panel = useSidePanelState();
  const search = useSearchCards(params.searchQuery, collection?.active ?? false, getCardById);
  useFocusSearchParam(isMobile);

  if (error) return <BrowsePageError onRetry={retryLoad} />;

  const {filters} = params;
  const {rarities, binderOptions, sortedCards, matchedCards, filtered} = browseView(
    collection,
    cards,
    params,
    search.cards,
  );
  const listing = {cards: sortedCards, sortOrder: params.sortOrder, matched: matchedCards, filtered};
  const selectCard = (card: LorcanaCard) => {
    // A card from outside Core is not in CardDataContext: count the card handed over.
    trackCardSelected(getCardById(card.id) ?? card, 'browse');
    const printingFor = printingIdsFor(search.findCard, filters.rarities);
    openFromBrowse(openCardModal, card.id, {...listing, printingFor, resolveCard: search.resolveCard}, collection);
  };

  const binder = collection?.renderBinder(listing, selectCard) ?? undefined;
  // The binder's wide pool brings Keyword and Classification options Core never prints.
  const {keywords, classifications} = binderOptions ?? {
    keywords: uniqueKeywords,
    classifications: uniqueClassifications,
  };
  // One set of options for the dialog and the docked panel.
  const filterOptions = {
    inkFilters: params.inkFilters,
    typeFilters: params.typeFilters,
    costFilters: params.costFilters,
    filters,
    uniqueKeywords: keywords,
    uniqueClassifications: classifications,
    uniqueRarities: rarities,
    sets,
    // Collection mode's set is chosen in its collection panel, so it keeps no set filter.
    showSetFilter: !collection?.active,
    // The art presets pick rarities, so they work in both modes (owner, 2026-10-15).
    showArtPresets: true,
  };

  const contentProps = {
    isMobile,
    toolbarProps: toolbarPropsFrom(params, {
      ...filtersButton(docked, panel, () => setShowFilters(true)),
      ...collectionToolbar(docked, collection, listing),
      isMobile,
      rarities,
    }),
    sidePanel: dockedPanel(docked, panel, {
      filterProps: {
        ...filterOptions,
        onToggleInk: params.toggleInk,
        onToggleType: params.toggleType,
        onToggleCost: params.toggleCost,
        onFiltersChange: params.setFilters,
      },
      activeFilterCount: params.activeFilterCount,
      onClearFilters: () => params.replaceFilters([], [], [], {}),
    }),
    setPanel: dockedSetPanel(docked, collection?.renderSetPanel(listing)),
    cards: sortedCards,
    // While sets 1-8 load, a search only they match would otherwise read "No cards match".
    isLoading: isLoading || (search.isLoading && sortedCards.length === 0),
    onCardSelect: selectCard,
    printingFor: tilePrintingFor(search.findCard, filters.rarities),
    hasCardPage: search.hasCardPage,
    binder,
  };

  return (
    <BrowseShell
      isMobile={isMobile}
      goHome={params.clearAllFilters}
      contentProps={contentProps}
      filterDialogProps={{
        ...filterOptions,
        isOpen: showFilters,
        onClose: () => setShowFilters(false),
        onApply: params.replaceFilters,
      }}
      prompts={collection?.prompts}
    />
  );
}
