import {useRef, useState} from 'react';
import {useParams, useNavigate, Navigate} from 'react-router-dom';
import type {PlaystyleId, LorcanaCard} from 'inkweave-synergy-engine';
import {getPlaystyleById, mechanicDescription, mechanicLabel} from '../features/synergies/engineCatalog';
import {
  usePlaystyleGuides,
  usePrecomputedPlaystyleCards,
  type GuidesStatus,
  type MechanicIdsByCard,
  type MechanicsStatus,
} from '../features/synergies/hooks';
import {PlaystyleGuide, type PlaystyleGuideProps} from '../features/playstyles';
import {
  RoleTiles,
  type RoleTile,
  type RoleTilesStatus,
} from '../features/synergies/components/RoleTileRow';
import {MechanicsBottomSheet} from '../features/synergies/components/MechanicsBottomSheet';
import {MechanicsButton} from '../features/synergies/components/MechanicsButton';
import {Chip} from 'inkweave-ui/components/Chip';
import {BrowseToolbar, CardGrid, CardGridSkeleton} from '../features/cards';
import {
  searchCardsByName,
  filterCards,
  applySortOrder,
  type CardFilterOptions,
} from '../features/cards/loader';
import {getPoolFilterOptions} from '../features/cards/filterOptions';
import {CompactHeader, CtaButton, ErrorBoundary, EtherealBackground, FilterDialog, Seo} from '../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  LAYOUT,
  LETTER_SPACING,
  SPACING,
  PLAYSTYLE_UI,
  accentRgba,
} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {trackCardSelected} from '../features/cards/lib/cardAnalytics';
import {useCardModal} from '../shared/contexts/CardModalContext';
import {useResponsive, useFilterParams} from '../shared/hooks';

// ── Hero layout configs ──

interface HeroLayout {
  padding: string;
  contentGap: number;
  headerGap: number;
  breadcrumbLinkMinHeight: number | undefined;
}

const HERO_DESKTOP: HeroLayout = {
  padding: '20px 32px',
  contentGap: 12,
  headerGap: 12,
  breadcrumbLinkMinHeight: undefined,
};

const HERO_MOBILE: HeroLayout = {
  padding: '16px',
  contentGap: 10,
  headerGap: 10,
  breadcrumbLinkMinHeight: 44,
};

// ── Card grid ──

/** The room under the card grid, past the spacing scale's top step (SPACING.xxxl, 32). */
const GRID_PADDING_BOTTOM = 48;
/**
 * The card grid's padding on phones and on desktop, shared by the loaded grid and its loading
 * one, so the loading grid has the loaded grid's columns and tile width (#914).
 */
const PHONE_GRID_PADDING = `${SPACING.md}px ${SPACING.lg}px ${GRID_PADDING_BOTTOM}px`;
const DESKTOP_GRID_PADDING = `${SPACING.xxl}px ${SPACING.xxxl}px ${GRID_PADDING_BOTTOM}px`;

/** The guide under the card grid (#995): the grid's sides, and the grid's room under it. */
const PHONE_GUIDE_PADDING = `0 ${SPACING.lg}px ${GRID_PADDING_BOTTOM}px`;
const DESKTOP_GUIDE_PADDING = `0 ${SPACING.xxxl}px ${GRID_PADDING_BOTTOM}px`;

/** What the views hand the guide under their grids, which adds their own padding (#995). */
type GuideSection = Omit<PlaystyleGuideProps, 'padding'>;

// ── Hero Section ──

function PlaystyleHero({
  name,
  tagline,
  accentColor,
  accentRgb,
  layout,
  onPlaystylesBreadcrumb,
}: {
  name: string;
  tagline: string;
  accentColor: string;
  accentRgb: string;
  layout: HeroLayout;
  onPlaystylesBreadcrumb: () => void;
}) {
  return (
    <section
      style={{
        position: 'relative',
        padding: layout.padding,
        overflow: 'hidden',
        borderBottom: `1px solid ${accentRgba(accentRgb, 0.25)}`,
        boxShadow: `0 4px 20px ${accentRgba(accentRgb, 0.08)}`,
      }}>
      {/* Accent bar */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: 4,
          height: '100%',
          background: accentColor,
          zIndex: 3,
        }}
      />
      {/* Content */}
      <div
        style={{
          position: 'relative',
          zIndex: 2,
          display: 'flex',
          flexDirection: 'column',
          gap: layout.contentGap,
        }}>
        {/* Breadcrumb */}
        <nav
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            color: COLORS.textMuted,
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
          }}>
          <a
            href="/playstyles"
            onClick={(e) => {
              e.preventDefault();
              onPlaystylesBreadcrumb();
            }}
            style={{
              color: COLORS.textMuted,
              textDecoration: 'none',
              cursor: 'pointer',
              minHeight: layout.breadcrumbLinkMinHeight,
              display: 'flex',
              alignItems: 'center',
            }}>
            Playstyles
          </a>
          <span aria-hidden="true" style={{fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim}}>/</span>
          <span style={{color: COLORS.text, fontWeight: 500}}>{name}</span>
        </nav>

        {/* Header: accent dot + name */}
        <div style={{display: 'flex', alignItems: 'center', gap: layout.headerGap}}>
          <span
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: accentColor,
              flexShrink: 0,
            }}
          />
          <h1
            style={{
              fontSize: `${FONT_SIZES.xxl}px`,
              fontWeight: 700,
              letterSpacing: LETTER_SPACING.eyebrow,
              textTransform: 'uppercase',
              margin: 0,
            }}>
            {name}
          </h1>
        </div>

        {tagline && (
          <p
            style={{
              margin: 0,
              fontSize: `${FONT_SIZES.base}px`,
              color: COLORS.textMuted,
              maxWidth: 640,
              lineHeight: 1.5,
            }}>
            {tagline}
          </p>
        )}
      </div>
    </section>
  );
}

// ── Role filter helpers ──

interface RoleChip {
  role: string;
  label: string;
  tooltip: string;
  count: number;
}

/** Synthetic role for Location card type (not a real engine role) */
const LOCATION_CARD_ROLE = 'location' as const;

/** Location Control's extra tile: its Location cards, a card type rather than a mechanic. */
function locationCardChips(cards: LorcanaCard[]): RoleChip[] {
  const count = cards.filter((c) => c.type === 'Location').length;
  return count > 0 ? [{role: LOCATION_CARD_ROLE, label: 'Locations', tooltip: 'Location cards', count}] : [];
}

/**
 * Aggregate a playstyle's cards into deduped mechanic chips — one chip per
 * canonical mechanic id, counted across the cards, labelled from the catalog.
 * Precompute lists each card's ids (`getPlaystyleMechanicIds`, `_playstyleMechanics.json`),
 * so this page runs no detector. See MECHANICS_TAXONOMY.md.
 */
function getRoleChips(
  playstyleId: PlaystyleId | undefined,
  cards: LorcanaCard[],
  mechanicIds: MechanicIdsByCard,
): RoleChip[] {
  if (!playstyleId) return [];
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const id of mechanicIds[card.id] ?? []) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const extras = playstyleId === 'location-control' ? locationCardChips(cards) : [];
  const chips = [...counts].map(([role, count]) => ({
    role,
    label: mechanicLabel(role),
    tooltip: mechanicDescription(role, playstyleId),
    count,
  }));
  return [...extras, ...chips];
}

function toRoleTile(chip: RoleChip): RoleTile {
  return {
    role: chip.role,
    label: chip.label,
    description: chip.tooltip,
    count: chip.count,
  };
}

/** Check if a card has a specific role within its playstyle: the same ids that build the tiles. */
function cardHasRole(
  playstyleId: PlaystyleId,
  card: LorcanaCard,
  role: string,
  mechanicIds: MechanicIdsByCard,
): boolean {
  if (playstyleId === 'location-control' && role === LOCATION_CARD_ROLE) {
    return card.type === 'Location';
  }
  return mechanicIds[card.id]?.includes(role) ?? false;
}

// ── Centered page style ──

const centeredPage = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: FONTS.body,
} as const;

// ── Derived-state helpers (extracted to keep page CC under threshold) ──

function buildCombinedFilters(
  filters: CardFilterOptions,
  inkFilters: Extract<CardFilterOptions['ink'], readonly unknown[]>,
  typeFilters: Extract<CardFilterOptions['type'], readonly unknown[]>,
  costFilters: NonNullable<CardFilterOptions['costs']>,
): CardFilterOptions {
  const combined: CardFilterOptions = {...filters};
  if (inkFilters.length > 0) combined.ink = inkFilters;
  if (typeFilters.length > 0) combined.type = typeFilters;
  if (costFilters.length > 0) combined.costs = costFilters;
  return combined;
}

function applyFilterAndSort(
  cards: LorcanaCard[],
  searchQuery: string,
  combinedFilters: CardFilterOptions,
  sortOrder: Parameters<typeof applySortOrder>[1],
): LorcanaCard[] {
  let result = cards;
  if (searchQuery.trim()) result = searchCardsByName(result, searchQuery);
  if (Object.keys(combinedFilters).length > 0) result = filterCards(result, combinedFilters);
  return applySortOrder(result, sortOrder);
}

/** Narrow the card list to those matching ANY active mechanic chip. */
function applyRoleFilter(
  cards: LorcanaCard[],
  activeRoles: ReadonlySet<string>,
  playstyleId: PlaystyleId | undefined,
  mechanicIds: MechanicIdsByCard,
): LorcanaCard[] {
  if (activeRoles.size === 0 || !playstyleId) return cards;
  const roles = [...activeRoles];
  return cards.filter((card) => roles.some((r) => cardHasRole(playstyleId, card, r, mechanicIds)));
}

function getHeroLayout(isMobile: boolean): HeroLayout {
  return isMobile ? HERO_MOBILE : HERO_DESKTOP;
}

/** Toggle membership of an item in an immutable Set, returning the new Set. */
function toggleSetMember<T>(prev: Set<T>, item: T): Set<T> {
  const next = new Set(prev);
  if (next.has(item)) next.delete(item);
  else next.add(item);
  return next;
}

/**
 * Bundle the BrowseToolbar + FilterDialog props for PlaystyleDetailPage.
 * Extracted so the page component stays under the Large Method threshold.
 * The filter options are narrowed to the playstyle's cards (#248).
 */
function buildPlaystyleViewProps(args: {
  cards: LorcanaCard[];
  showFilters: boolean;
  setShowFilters: (open: boolean) => void;
  activeFilterCount: number;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  inkFilters: ToolbarProps['inkFilters'];
  typeFilters: ToolbarProps['typeFilters'];
  costFilters: ToolbarProps['costFilters'];
  filters: ToolbarProps['filters'];
  toggleInk: ToolbarProps['onToggleInk'];
  toggleType: ToolbarProps['onToggleType'];
  toggleCost: ToolbarProps['onToggleCost'];
  clearCosts: ToolbarProps['onClearCosts'];
  setFilters: ToolbarProps['onFiltersChange'];
  replaceFilters: FilterDialogSharedProps['onApply'];
  sortOrder: ToolbarProps['sortOrder'];
  setSortOrder: ToolbarProps['onSortChange'];
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueRarities: string[];
  sets: FilterDialogSharedProps['sets'];
}): {toolbarProps: ToolbarProps; filterDialogProps: FilterDialogSharedProps} {
  const applied = {
    inks: args.inkFilters,
    types: args.typeFilters,
    costs: args.costFilters,
    filters: args.filters,
  };
  const all = {
    keywords: args.uniqueKeywords,
    classifications: args.uniqueClassifications,
    rarities: args.uniqueRarities,
    sets: args.sets,
  };
  const options = getPoolFilterOptions(args.cards, applied, all);
  const toolbarProps: ToolbarProps = {
    onFiltersClick: () => args.setShowFilters(true),
    activeFilterCount: args.activeFilterCount,
    searchQuery: args.searchQuery,
    onSearchChange: args.setSearchQuery,
    inkFilters: args.inkFilters,
    typeFilters: args.typeFilters,
    costFilters: args.costFilters,
    filters: args.filters,
    onToggleInk: args.toggleInk,
    onToggleType: args.toggleType,
    onToggleCost: args.toggleCost,
    onClearCosts: args.clearCosts,
    onFiltersChange: args.setFilters,
    sortOrder: args.sortOrder,
    onSortChange: args.setSortOrder,
    buttonOptions: options.buttons,
  };
  const filterDialogProps: FilterDialogSharedProps = {
    isOpen: args.showFilters,
    onClose: () => args.setShowFilters(false),
    onApply: args.replaceFilters,
    inkFilters: args.inkFilters,
    typeFilters: args.typeFilters,
    costFilters: args.costFilters,
    filters: args.filters,
    uniqueKeywords: options.keywords,
    uniqueClassifications: options.classifications,
    uniqueRarities: options.rarities,
    sets: options.sets,
    buttonOptions: options.buttons,
  };
  return {toolbarProps, filterDialogProps};
}

function useResolvedPlaystyle(playstyleId: string | undefined) {
  const playstyle = playstyleId ? getPlaystyleById(playstyleId as PlaystyleId) : undefined;
  const ui = playstyleId ? PLAYSTYLE_UI[playstyleId as PlaystyleId] : undefined;
  return {playstyle, ui};
}

function usePlaystyleNavReset(
  playstyleId: string | undefined,
  setActiveRoles: (roles: Set<string>) => void,
) {
  const [prev, setPrev] = useState(playstyleId);
  if (playstyleId !== prev) {
    setPrev(playstyleId);
    setActiveRoles(new Set());
  }
}

// ── Page ──

export function PlaystyleDetailPage() {
  const {playstyleId} = useParams<{playstyleId: string}>();
  const navigate = useNavigate();
  const {openCardModal} = useCardModal();
  const {isMobile} = useResponsive();
  const {isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, uniqueRarities, sets, getCardById} =
    useCardDataContext();
  const {
    searchQuery,
    setSearchQuery,
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    clearCosts,
    filters,
    setFilters,
    replaceFilters,
    activeFilterCount,
    sortOrder,
    setSortOrder,
    // A playstyle's cards show by colour, then cost, from the first render on (#915).
  } = useFilterParams({defaultSort: 'ink-cost'});
  const [showFilters, setShowFilters] = useState(false);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(() => new Set());
  usePlaystyleNavReset(playstyleId, setActiveRoles);
  const toggleRole = (role: string) => setActiveRoles((prev) => toggleSetMember(prev, role));

  const {playstyle, ui} = useResolvedPlaystyle(playstyleId);
  const playstyleLoad = usePlaystyleDetailLoad(playstyle?.id, {isLoading, error, retry: retryLoad});
  const {cards: playstyleCards, mechanicIds, pageLoad, tileRow, guide} = playstyleLoad;

  const combinedFilters = buildCombinedFilters(filters, inkFilters, typeFilters, costFilters);
  const sortedCards = applyFilterAndSort(playstyleCards, searchQuery, combinedFilters, sortOrder);
  const roleChips = getRoleChips(playstyle?.id, sortedCards, mechanicIds);
  const roleFilteredCards = applyRoleFilter(sortedCards, activeRoles, playstyle?.id, mechanicIds);
  const displayedCards = roleFilteredCards.slice(0, LAYOUT.maxDisplayedCards);

  const goHome = () => navigate('/');
  const goPlaystyles = () => navigate('/playstyles');
  // A card opened from the grid or the guide's key cards, with the cards it came from as its list.
  const openCard = (cardId: string, cardIds: string[]) => {
    trackCardSelected(getCardById(cardId), 'playstyle');
    openCardModal(cardId, cardIds);
  };
  const handleCardSelect = (card: {id: string}) => openCard(card.id, displayedCards.map((c) => c.id));

  // An unknown id: the gallery. Ids resolve with no data, so this needs no wait.
  if (!playstyle || !ui) return <Navigate to="/playstyles" replace />;

  // A list that failed shows the error once neither list is still loading.
  if (!pageLoad.isLoading && pageLoad.retry) return <PlaystyleDetailError onRetry={pageLoad.retry} />;

  const heroLayout = getHeroLayout(isMobile);
  const {toolbarProps, filterDialogProps} = buildPlaystyleViewProps({
    cards: playstyleCards,
    showFilters,
    setShowFilters,
    activeFilterCount,
    searchQuery,
    setSearchQuery,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    toggleInk,
    toggleType,
    toggleCost,
    clearCosts,
    setFilters,
    replaceFilters,
    sortOrder,
    setSortOrder,
    uniqueKeywords,
    uniqueClassifications,
    uniqueRarities,
    sets,
  });
  // The guide under the cards, there once the page has loaded (#995). It finds its key cards among
  // all of the playstyle's cards, so a filter that hides one doesn't take it off the guide.
  const guideSection = {name: playstyle.name, guide, cards: playstyleCards, onOpenCard: openCard};

  // While the card data or the playstyles' own lists load, the views draw the hero and the
  // toolbar as loaded, with placeholders for the mechanics and the cards, so nothing moves when
  // the lists land (#914). Waiting for both keeps "No cards match your filters." off the page
  // until the playstyle's cards arrive (#913).
  if (isMobile) {
    return (
      <PlaystyleDetailMobileView
        isLoading={pageLoad.isLoading}
        playstyle={playstyle}
        ui={ui}
        heroLayout={heroLayout}
        goHome={goHome}
        goPlaystyles={goPlaystyles}
        handleCardSelect={handleCardSelect}
        tileRow={tileRow}
        roleChips={roleChips}
        activeRoles={activeRoles}
        toggleRole={toggleRole}
        clearRoles={() => setActiveRoles(new Set())}
        roleFilteredCards={roleFilteredCards}
        displayedCards={displayedCards}
        guideSection={guideSection}
        toolbarProps={toolbarProps}
        filterDialogProps={filterDialogProps}
      />
    );
  }

  return (
    <PlaystyleDetailDesktopView
      isLoading={pageLoad.isLoading}
      playstyle={playstyle}
      ui={ui}
      heroLayout={heroLayout}
      goHome={goHome}
      goPlaystyles={goPlaystyles}
      handleCardSelect={handleCardSelect}
      tileRow={tileRow}
      roleChips={roleChips}
      activeRoles={activeRoles}
      toggleRole={toggleRole}
      roleFilteredCards={roleFilteredCards}
      displayedCards={displayedCards}
      guideSection={guideSection}
      toolbarProps={toolbarProps}
      filterDialogProps={filterDialogProps}
    />
  );
}

/** A list the page loads. */
interface PageLoad {
  isLoading: boolean;
  error: Error | null;
  retry: () => void;
}

/**
 * The card data, the playstyles' lists and the guides' first load as one load: loading while
 * any is, and the retry for whichever list failed, the card data first, or null when both
 * loaded. The guides never fail the page: a failure leaves only the guide out (#995).
 */
function combineLoads(
  cardData: PageLoad,
  playstyleCards: PageLoad,
  guides: GuidesStatus,
): {isLoading: boolean; retry: (() => void) | null} {
  const failed = [cardData, playstyleCards].find((load) => load.error);
  const isLoading = cardData.isLoading || playstyleCards.isLoading || guides === 'loading';
  return {isLoading, retry: failed?.retry ?? null};
}

/** The mechanic tiles' state on the page, and the retry their failure offers (#930). */
interface TileRow {
  status: RoleTilesStatus;
  retry: () => void;
}

/**
 * The mechanic tiles' state: loading while the page is, and while they load again after a
 * failure, which only the tiles wait for (#930).
 */
function tileRowStatus(pageLoading: boolean, mechanics: MechanicsStatus): RoleTilesStatus {
  if (pageLoading || mechanics === 'reloading') return 'loading';
  return mechanics === 'failed' ? 'failed' : 'loaded';
}

/**
 * The playstyle's cards, mechanic ids and guide, the page's load over them and the card data,
 * and the tiles' own state, which fails without failing the page (#930). The guide is there
 * once the page has loaded, and missing when the guides failed (#995).
 */
function usePlaystyleDetailLoad(playstyleId: PlaystyleId | undefined, cardData: PageLoad) {
  const {cards, mechanicIds, mechanicsStatus, retryMechanics, ...playstyleCardsLoad} =
    usePrecomputedPlaystyleCards(playstyleId);
  const guides = usePlaystyleGuides();
  const pageLoad = combineLoads(cardData, playstyleCardsLoad, guides.status);
  const tileRow: TileRow = {
    status: tileRowStatus(pageLoad.isLoading, mechanicsStatus),
    retry: retryMechanics,
  };
  const guide = pageLoad.isLoading || !playstyleId ? undefined : guides.guides?.[playstyleId];
  return {cards, mechanicIds, pageLoad, tileRow, guide};
}

// ── Page sub-views (extracted to keep PlaystyleDetailPage under CC 10) ──

type ResolvedPlaystyle = NonNullable<ReturnType<typeof getPlaystyleById>>;
type PlaystyleUIValue = (typeof PLAYSTYLE_UI)[PlaystyleId];

interface ToolbarProps {
  onFiltersClick: () => void;
  activeFilterCount: number;
  searchQuery: Parameters<typeof BrowseToolbar>[0]['searchQuery'];
  onSearchChange: Parameters<typeof BrowseToolbar>[0]['onSearchChange'];
  inkFilters: Parameters<typeof BrowseToolbar>[0]['inkFilters'];
  typeFilters: Parameters<typeof BrowseToolbar>[0]['typeFilters'];
  costFilters: Parameters<typeof BrowseToolbar>[0]['costFilters'];
  filters: Parameters<typeof BrowseToolbar>[0]['filters'];
  onToggleInk: Parameters<typeof BrowseToolbar>[0]['onToggleInk'];
  onToggleType: Parameters<typeof BrowseToolbar>[0]['onToggleType'];
  onToggleCost: Parameters<typeof BrowseToolbar>[0]['onToggleCost'];
  onClearCosts: Parameters<typeof BrowseToolbar>[0]['onClearCosts'];
  onFiltersChange: Parameters<typeof BrowseToolbar>[0]['onFiltersChange'];
  sortOrder: Parameters<typeof BrowseToolbar>[0]['sortOrder'];
  onSortChange: Parameters<typeof BrowseToolbar>[0]['onSortChange'];
  buttonOptions: Parameters<typeof BrowseToolbar>[0]['buttonOptions'];
}

interface FilterDialogSharedProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: Parameters<typeof FilterDialog>[0]['onApply'];
  inkFilters: Parameters<typeof FilterDialog>[0]['inkFilters'];
  typeFilters: Parameters<typeof FilterDialog>[0]['typeFilters'];
  costFilters: Parameters<typeof FilterDialog>[0]['costFilters'];
  filters: Parameters<typeof FilterDialog>[0]['filters'];
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  uniqueRarities: string[];
  sets: Parameters<typeof FilterDialog>[0]['sets'];
  buttonOptions: Parameters<typeof FilterDialog>[0]['buttonOptions'];
}

/**
 * Per-route metadata for a playstyle page (React 19 native, self-referential canonical). The
 * views render it once the cards are in: the prerender captures a page as soon as its title is
 * the page's own (scripts/prerender.mjs), so a title in the loading page would capture its
 * placeholders.
 */
function PlaystyleSeo({playstyle}: {playstyle: ResolvedPlaystyle}) {
  return (
    <Seo
      title={`${playstyle.name} Deck Archetype | Lorcana Synergies | Inkweave`}
      description={`${playstyle.tagline} Explore the cards, enablers, and payoffs that define the ${playstyle.name} archetype in Disney Lorcana Core format.`}
      canonicalPath={`/playstyles/${playstyle.id}`}
    />
  );
}

function PlaystyleDetailError({onRetry}: {onRetry: () => void}) {
  return (
    <div style={centeredPage}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
        Failed to load card data.
      </p>
      <CtaButton onClick={onRetry}>Retry</CtaButton>
    </div>
  );
}

/**
 * The playstyle's cards: the loading grid, in the loaded grid's padding, until they arrive
 * (#914), then the grid, or its empty message when no card matches the filters.
 */
function PlaystyleCardGrid({
  isLoading,
  cards,
  displayedCards,
  handleCardSelect,
  padding,
  borderRadius,
}: {
  isLoading: boolean;
  cards: LorcanaCard[];
  displayedCards: LorcanaCard[];
  handleCardSelect: (card: LorcanaCard) => void;
  padding: string;
  borderRadius?: number;
}) {
  if (isLoading) return <CardGridSkeleton rows={3} padding={padding} ariaLabel="Loading playstyle cards" />;
  return (
    <div style={{padding}}>
      <CardGrid
        cards={displayedCards}
        onSelect={handleCardSelect}
        variant="minimal"
        borderRadius={borderRadius}
        linkToCards
        emptyMessage={cards.length === 0 ? 'No cards match your filters.' : undefined}
      />
    </div>
  );
}

/**
 * The desktop mechanics row, over a gold rule. While the cards load, its placeholder holds the
 * row's box, so the grid starts where it will (#914). When the tiles failed and the cards did
 * not, the row says so in the same box, with a Try again (#930).
 */
function DesktopMechanicsRow({
  tileRow,
  roleChips,
  activeRoles,
  toggleRole,
}: {
  tileRow: TileRow;
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
}) {
  const rowRef = useRef<HTMLDivElement>(null);
  if (tileRow.status === 'loaded' && roleChips.length === 0) return null;
  // Try again swaps its line for the placeholder, which unmounts the button that had focus, so
  // the row takes focus first and keeps it while the tiles load, as the binder does (#790).
  const retry = () => {
    rowRef.current?.focus();
    tileRow.retry();
  };
  return (
    <div
      ref={rowRef}
      tabIndex={-1}
      role="group"
      aria-label="Mechanics"
      style={{padding: '32px 32px 0'}}>
      <RoleTiles
        status={tileRow.status}
        onRetry={retry}
        tiles={roleChips.map(toRoleTile)}
        activeRoles={activeRoles}
        onToggle={toggleRole}
        showDescriptions={false}
      />
      <hr
        aria-hidden="true"
        style={{
          height: 1,
          border: 'none',
          background: `linear-gradient(90deg, transparent, ${COLORS.primary500} 50%, transparent)`,
          margin: 0,
        }}
      />
    </div>
  );
}

function PlaystyleDetailMobileView({
  isLoading,
  playstyle,
  ui,
  heroLayout,
  goHome,
  goPlaystyles,
  handleCardSelect,
  tileRow,
  roleChips,
  activeRoles,
  toggleRole,
  clearRoles,
  roleFilteredCards,
  displayedCards,
  guideSection,
  toolbarProps,
  filterDialogProps,
}: {
  isLoading: boolean;
  playstyle: ResolvedPlaystyle;
  ui: PlaystyleUIValue;
  heroLayout: HeroLayout;
  goHome: () => void;
  goPlaystyles: () => void;
  handleCardSelect: (card: {id: string}) => void;
  tileRow: TileRow;
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
  clearRoles: () => void;
  roleFilteredCards: LorcanaCard[];
  displayedCards: LorcanaCard[];
  guideSection: GuideSection;
  toolbarProps: ToolbarProps;
  filterDialogProps: FilterDialogSharedProps;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Render MechanicsButton + active role chips into the toolbar's extraChips slot
  // so they sit alongside ink/cost filter chips instead of in a separate row. While the
  // cards load, the button holds its place, off. When the tiles failed, it opens the sheet
  // that says so, with its Try again (#930).
  const toolbarExtras =
    tileRow.status !== 'loaded' || roleChips.length > 0 ? (
      <>
        <MechanicsButton
          onClick={() => setSheetOpen(true)}
          activeCount={activeRoles.size}
          isMobile
          disabled={isLoading}
        />
        {[...activeRoles].map((role) => {
          const chip = roleChips.find((c) => c.role === role);
          if (!chip) return null;
          return (
            <Chip
              key={role}
              variant="dismiss"
              label={chip.label}
              onDismiss={() => toggleRole(role)}
              isMobile
            />
          );
        })}
      </>
    ) : null;

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        position: 'relative',
      }}>
      {!isLoading && <PlaystyleSeo playstyle={playstyle} />}
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} isMobile />
      <div style={{position: 'relative', zIndex: 1}}>
        <PlaystyleHero
          name={playstyle.name}
          tagline={playstyle.tagline}
          accentColor={ui.accentColor}
          accentRgb={ui.accentRgb}
          layout={heroLayout}
          onPlaystylesBreadcrumb={goPlaystyles}
        />
        <BrowseToolbar {...toolbarProps} isMobile extraChips={toolbarExtras} />
        <ErrorBoundary>
          <PlaystyleCardGrid
            isLoading={isLoading}
            cards={roleFilteredCards}
            displayedCards={displayedCards}
            handleCardSelect={handleCardSelect}
            padding={PHONE_GRID_PADDING}
            borderRadius={10}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <PlaystyleGuide {...guideSection} padding={PHONE_GUIDE_PADDING} />
        </ErrorBoundary>
      </div>
      <FilterDialog {...filterDialogProps} variant="drawer" />
      <MechanicsBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tiles={roleChips.map(toRoleTile)}
        status={tileRow.status}
        onRetry={tileRow.retry}
        activeRoles={activeRoles}
        onToggle={toggleRole}
        onClearAll={clearRoles}
      />
    </main>
  );
}

function PlaystyleDetailDesktopView({
  isLoading,
  playstyle,
  ui,
  heroLayout,
  goHome,
  goPlaystyles,
  handleCardSelect,
  tileRow,
  roleChips,
  activeRoles,
  toggleRole,
  roleFilteredCards,
  displayedCards,
  guideSection,
  toolbarProps,
  filterDialogProps,
}: {
  isLoading: boolean;
  playstyle: ResolvedPlaystyle;
  ui: PlaystyleUIValue;
  heroLayout: HeroLayout;
  goHome: () => void;
  goPlaystyles: () => void;
  handleCardSelect: (card: {id: string}) => void;
  tileRow: TileRow;
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
  roleFilteredCards: LorcanaCard[];
  displayedCards: LorcanaCard[];
  guideSection: GuideSection;
  toolbarProps: ToolbarProps;
  filterDialogProps: FilterDialogSharedProps;
}) {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        fontFamily: FONTS.body,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}>
      {!isLoading && <PlaystyleSeo playstyle={playstyle} />}
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} />
      <div
        style={{
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        <PlaystyleHero
          name={playstyle.name}
          tagline={playstyle.tagline}
          accentColor={ui.accentColor}
          accentRgb={ui.accentRgb}
          layout={heroLayout}
          onPlaystylesBreadcrumb={goPlaystyles}
        />
        <BrowseToolbar {...toolbarProps} isMobile={false} />
        <DesktopMechanicsRow
          tileRow={tileRow}
          roleChips={roleChips}
          activeRoles={activeRoles}
          toggleRole={toggleRole}
        />
        <ErrorBoundary>
          <PlaystyleCardGrid
            isLoading={isLoading}
            cards={roleFilteredCards}
            displayedCards={displayedCards}
            handleCardSelect={handleCardSelect}
            padding={DESKTOP_GRID_PADDING}
          />
        </ErrorBoundary>
        <ErrorBoundary>
          <PlaystyleGuide {...guideSection} padding={DESKTOP_GUIDE_PADDING} />
        </ErrorBoundary>
      </div>
      <FilterDialog {...filterDialogProps} variant="modal" />
    </main>
  );
}
