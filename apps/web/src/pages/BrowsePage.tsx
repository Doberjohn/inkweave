import {useEffect, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {BrowseBinder, BrowseCardGrid, BrowseToolbar, type Ink} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../features/cards/loader';
import {CompactHeader, CtaButton, ErrorBoundary, EtherealBackground, FilterDialog, MOBILE_NAV_HEIGHT, PageTitle, Seo} from '../shared/components';
import {SignInDialog} from '../shared/components/SignInDialog';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  SPACING,
  type BrowseSortOrder,
  type CardTypeFilter,
} from '../shared/constants';
import {
  useCollection,
  useCollectionPool,
  collectionAction,
  CollectionBinderSection,
  ImportCollectionDialog,
  type CollectionEntries,
} from '../features/collection';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useSession} from '../shared/contexts/SessionContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

// =====================================================================
// Module-level helpers — keep BrowsePage's CC low by hoisting branches.
// =====================================================================

/**
 * The pool toggle, sitting beside Filters.
 *
 * A toggle button rather than a two-tab list: the modes are not peers. "All
 * cards" is the page's resting state and "Collection" is a lens you put on, so
 * one pressable control says that where two tabs imply an even choice — and it
 * costs a fraction of the toolbar width, which the binder spends on card size.
 *
 * GHOST when off, matching the home page's "Explore playstyles" CTA, and the
 * GOLD_GLOW selection recipe when on — never `filled`: Filters is already the
 * toolbar's one filled gold button, and a second would make two competing
 * primaries. `aria-pressed` carries the state for anyone not seeing the glow.
 */
function CollectionToggle({active, onToggle}: {active: boolean; onToggle: () => void}) {
  return (
    <CtaButton
      variant="ghost"
      onClick={onToggle}
      aria-pressed={active}
      aria-label="Show my collection"
      style={{
        height: 34,
        minHeight: 34,
        padding: '0 14px',
        flexShrink: 0,
        ...(active && {
          borderColor: GOLD_GLOW.activeBorder,
          background: GOLD_GLOW.activeBg,
          color: COLORS.primary,
          boxShadow: GOLD_GLOW.shadow,
        }),
      }}>
      Collection
    </CtaButton>
  );
}

/**
 * Consume `?focus=search` by focusing the desktop inline input once.
 *
 * A hook rather than an inline effect purely to keep the page function's
 * branches down — CodeScene counts a nested callback's conditionals against its
 * enclosing function, so an effect body is not free.
 */
function useSearchFocusParam(
  isMobile: boolean,
  searchParams: URLSearchParams,
  setSearchParams: (next: URLSearchParams, opts?: {replace?: boolean}) => void,
) {
  useEffect(() => {
    // Desktop only; mobile searches through the bottom sheet.
    if (isMobile || searchParams.get('focus') !== 'search') return;
    requestAnimationFrame(() => {
      document.querySelector<HTMLInputElement>('[data-testid="browse-search"]')?.focus();
    });
    searchParams.delete('focus');
    setSearchParams(searchParams, {replace: true});
  }, [isMobile, searchParams, setSearchParams]);
}

/**
 * Both prompts the Collection button can raise. Mutually exclusive by
 * construction — the sign-in check runs first, so you can never reach the import
 * without an account — which is why they can mount unconditionally together.
 */
function CollectionPrompts({
  showSignIn,
  onSignInClose,
  showImport,
  onImportClose,
  pool,
  poolLoading,
  poolError,
  importCollection,
  onImported,
}: {
  showSignIn: boolean;
  onSignInClose: () => void;
  showImport: boolean;
  onImportClose: () => void;
  pool: LorcanaCard[];
  poolLoading: boolean;
  poolError: string | null;
  importCollection: (entries: CollectionEntries, importedAt: number) => string | null;
  onImported: () => void;
}) {
  return (
    <>
      <SignInDialog isOpen={showSignIn} onClose={onSignInClose} />
      <ImportCollectionDialog
        isOpen={showImport}
        onClose={onImportClose}
        pool={pool}
        // Blocks a parse against the Core-only pool while the 15 non-Core chunks
        // are still landing; that parse does not fail, it silently drops two
        // thirds of a real collection.
        isPoolReady={!poolLoading && poolError === null}
        // Land in collection mode on success. The reader pressed "Collection"
        // and was diverted through an import to get there; leaving them on the
        // all-cards grid afterwards makes a successful import look like nothing
        // happened. Only on success — `importCollection` returns a message when
        // storage refused the write, and switching then would show an empty
        // binder as if it had worked.
        onImport={(imported, at) => {
          const storageError = importCollection(imported, at);
          if (storageError === null) onImported();
          return storageError;
        }}
      />
    </>
  );
}

/**
 * The Collection button's click behaviour, built outside the page so its
 * three-way branch is not counted against the page's complexity.
 */
function makeCollectionClick(deps: {
  signedIn: boolean;
  hasCollection: boolean;
  collectionMode: boolean;
  setShowSignIn: (v: boolean) => void;
  setShowImport: (v: boolean) => void;
  setCollectionMode: (v: boolean) => void;
}): () => void {
  return () => {
    const next = collectionAction({signedIn: deps.signedIn, hasCollection: deps.hasCollection});
    if (next === 'sign-in') return deps.setShowSignIn(true);
    if (next === 'import') return deps.setShowImport(true);
    deps.setCollectionMode(!deps.collectionMode);
  };
}

interface BinderChoice {
  collectionMode: boolean;
  binderView: boolean;
  pool: LorcanaCard[];
  sortedCards: LorcanaCard[];
  entries: CollectionEntries;
  poolLoading: boolean;
  poolError: string | null;
  onCardSelect: (card: LorcanaCard) => void;
}

/**
 * Which binder, if any, replaces the grid. Hoisted out of the page because the
 * three-way choice is the page's own complexity, not the content's.
 *
 * `matchedIds` is built INSIDE the collection branch: in grid mode it would be a
 * Set of up to 3,242 strings rebuilt on every render for nobody.
 */
function pickBinder({
  collectionMode,
  binderView,
  pool,
  sortedCards,
  entries,
  poolLoading,
  poolError,
  onCardSelect,
}: BinderChoice): React.ReactNode {
  if (collectionMode) {
    return (
      <CollectionBinderSection
        cards={pool}
        matchedIds={new Set(sortedCards.map((card) => card.id))}
        entries={entries}
        isLoading={poolLoading}
        error={poolError}
        onCardSelect={onCardSelect}
      />
    );
  }
  if (binderView) return <BrowseBinder cards={sortedCards} onCardSelect={onCardSelect} />;
  return null;
}

/**
 * The toolbar's props, assembled outside the page.
 *
 * Almost every field is a straight forward of `useFilterParams`, so building it
 * here lets the page hold the hook's result as ONE value instead of a
 * sixteen-name destructure — which is what pushed the page function past the
 * size gate. Only the three genuinely page-owned props are passed in.
 */
function buildToolbarProps(
  fp: ReturnType<typeof useFilterParams>,
  own: {isMobile: boolean; onFiltersClick: () => void; modeSwitch: React.ReactNode},
) {
  return {
    onFiltersClick: own.onFiltersClick,
    activeFilterCount: fp.activeFilterCount,
    inkFilters: fp.inkFilters,
    typeFilters: fp.typeFilters,
    costFilters: fp.costFilters,
    filters: fp.filters,
    onToggleInk: fp.toggleInk,
    onToggleType: fp.toggleType,
    onToggleCost: fp.toggleCost,
    onClearCosts: fp.clearCosts,
    onFiltersChange: fp.setFilters,
    sortOrder: fp.sortOrder,
    onSortChange: fp.setSortOrder,
    isMobile: own.isMobile,
    searchQuery: fp.searchQuery,
    onSearchChange: fp.setSearchQuery,
    /**
     * ALWAYS shown, never gated on having a collection. The button is the entry
     * point to the whole feature, so hiding it until you already had one made it
     * unreachable — the state it was meant to protect against is exactly the
     * state that needs the invitation. The three outcomes and their precedence
     * live in `collectionAction`, which is pure so the two branches needing a
     * real OAuth session are covered by assertions rather than by clicking.
     */
    modeSwitch: own.modeSwitch,
  } as const;
}

function buildCombinedFilters(
  base: CardFilterOptions,
  inkFilters: Ink[],
  typeFilters: CardTypeFilter[],
  costFilters: number[],
): CardFilterOptions {
  const combined: CardFilterOptions = {...base};
  if (inkFilters.length > 0) combined.ink = inkFilters;
  if (typeFilters.length > 0) combined.type = typeFilters;
  if (costFilters.length > 0) combined.costs = costFilters;
  return combined;
}

function applyFiltersAndSort(
  cards: LorcanaCard[],
  searchQuery: string,
  combinedFilters: CardFilterOptions,
  sortOrder: BrowseSortOrder,
): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return applySortOrder(result, sortOrder);
}

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
  onCardSelect: (card: {id: string}) => void;
  /** Collection mode's content. When set, it replaces the grid entirely. */
  binder?: React.ReactNode;
  /**
   * Drop the page title. The binder is not being decorative here: a spread has
   * to fit the viewport WITHOUT scrolling or it stops being a spread, and cards
   * derive from the height budget, so every band of chrome comes straight out of
   * the card size. The binder is also its own page identity, which makes
   * "Browse Cards" above it a label for something already obvious.
   */
  compactChrome?: boolean;
}

function BrowseContentSection({
  isMobile,
  toolbarProps,
  cards,
  isLoading,
  onCardSelect,
  binder,
  compactChrome,
}: BrowseContentSectionProps) {
  const titlePadding = isMobile
    ? `${SPACING.lg}px ${SPACING.lg}px 0`
    : `${SPACING.xxl}px 32px 0`;
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
      {!compactChrome && (
        <PageTitle style={{padding: titlePadding, flexShrink: 0}}>Browse Cards</PageTitle>
      )}
      {/* The toolbar serves BOTH modes: in binder mode its filters drive which
          slots stay lit rather than which cards are listed. Sort is the one
          control it keeps that the binder ignores — collector order IS the
          binder, so a sort would dismantle the thing being read. */}
      <BrowseToolbar {...toolbarProps} />
      {/* Card grid — flex-fills remaining space; VirtuosoGrid scrolls inside */}
      <div style={{flex: 1, minHeight: 0, position: 'relative'}}>
        <ErrorBoundary>
          {binder ?? <BrowseCardGrid cards={cards} isLoading={isLoading} onCardSelect={onCardSelect} />}
        </ErrorBoundary>
      </div>
    </div>
  );
}

/**
 * The viewport-bounded shell, one definition for both widths.
 *
 * The two branches differed only in height (mobile subtracts the bottom nav so
 * AppLayout's padding does not push past the viewport and re-introduce page
 * scroll) and in the filter dialog's variant. Keeping them as two literal
 * returns meant every shell change had to be made twice, and made the page
 * function long enough to trip the size gate on its own.
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

export function BrowsePage() {
  const {openCardModal} = useCardModal();
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets, getCardById} =
    useCardDataContext();
  const filterParams = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();
  const [collectionMode, setCollectionMode] = useState(false);
  const [showSignIn, setShowSignIn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const {user} = useSession();
  const {entries, hasCollection, importCollection} = useCollection();
  // MUST sit above the `if (error)` return below — it is a hook, and an early
  // return before it would change the hook order between renders.
  //
  // Only collection mode widens the pool, so a visitor who never switches pays
  // nothing: the 15 non-Core chunks are not fetched at all.
  const {pool, isLoading: poolLoading, error: poolError} = useCollectionPool(
    cards,
    collectionMode || showImport,
  );

  useSearchFocusParam(isMobile, searchParams, setSearchParams);

  if (error) return <BrowsePageError onRetry={retryLoad} />;

  const {filters, inkFilters, typeFilters, costFilters} = filterParams;
  const combinedFilters = buildCombinedFilters(filters, inkFilters, typeFilters, costFilters);
  const sortedCards = applyFiltersAndSort(
    pool,
    filterParams.searchQuery,
    combinedFilters,
    filterParams.sortOrder,
  );
  const goHome = filterParams.clearAllFilters;
  const selectCard = (card: {id: string}) => {
    trackCardSelected(getCardById(card.id), 'browse');
    openCardModal(card.id, sortedCards.map((c) => c.id));
  };

  const onCollectionClick = makeCollectionClick({
    signedIn: user !== null,
    hasCollection,
    collectionMode,
    setShowSignIn,
    setShowImport,
    setCollectionMode,
  });

  const toolbarProps = buildToolbarProps(filterParams, {
    isMobile,
    onFiltersClick: () => setShowFilters(true),
    modeSwitch: <CollectionToggle active={collectionMode} onToggle={onCollectionClick} />,
  });

  const filterDialogProps = {
    isOpen: showFilters,
    onClose: () => setShowFilters(false),
    onApply: filterParams.replaceFilters,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    uniqueKeywords,
    uniqueClassifications,
    sets,
  };

  // DESIGN SPIKE (#553): `?view=binder` swaps the grid for the paginated binder.
  // A URL flag rather than a toggle or a feature flag — it changes nothing by
  // default, survives a reload, and is one query param to delete once the design
  // is settled. Desktop only: the mobile ruling is that phones keep the scrolling
  // list (now 3-across), so a 4x3 twin spread must never reach one.
  const binderView = !isMobile && searchParams.get('view') === 'binder';
  const contentProps = {
    isMobile,
    toolbarProps,
    cards: sortedCards,
    isLoading,
    onCardSelect: selectCard,
    binder: pickBinder({
      collectionMode,
      binderView,
      pool,
      sortedCards,
      entries,
      poolLoading,
      poolError,
      onCardSelect: selectCard,
    }),
    compactChrome: binderView,
  };

  /**
   * Rendered in BOTH branches from one definition. Two dialogs that are mutually
   * exclusive by construction — you cannot lack an account and lack a collection
   * at the same decision point, because the sign-in check runs first.
   */
  const collectionPrompts = (
    <CollectionPrompts
      showSignIn={showSignIn}
      onSignInClose={() => setShowSignIn(false)}
      showImport={showImport}
      onImportClose={() => setShowImport(false)}
      pool={pool}
      poolLoading={poolLoading}
      poolError={poolError}
      importCollection={importCollection}
      onImported={() => setCollectionMode(true)}
    />
  );

  return (
    <BrowseShell
      isMobile={isMobile}
      goHome={goHome}
      contentProps={contentProps}
      filterDialogProps={filterDialogProps}
      prompts={collectionPrompts}
    />
  );
}
