import {useEffect, useRef, useState} from 'react';
import {useParams, useNavigate, useSearchParams, Navigate} from 'react-router-dom';
import {
  getPlaystyleById,
  getLocationRoles,
  getDiscardRoles,
  getSelfDiscardRoles,
  getSacrificeRoles,
  getRampRoles,
  getLoreDenialRoles,
  getToyRoles,
  getDwarfsRoles,
  getFloodbornRoles,
  getHunnyRoles,
  getRedPandaRoles,
  getItemRoles,
  getHealRoles,
  getExertRoles,
  getBounceRoles,
  getInkDropRoles,
  getTribalRoles,
  TRIBAL_SPECS,
  getCardMechanics,
  STRUCTURAL_ROLE_TO_MECHANIC,
  mechanicLabel,
  mechanicDescription,
  tribalMechanicDescription,
  type PlaystyleId,
  type LorcanaCard,
  type TribalSpec,
} from 'inkweave-synergy-engine';
import {usePrecomputedPlaystyleCards} from '../features/synergies/hooks';
import {RoleTileRow, RoleTileRowSkeleton, type RoleTile} from '../features/synergies/components/RoleTileRow';
import {MechanicsBottomSheet} from '../features/synergies/components/MechanicsBottomSheet';
import {MechanicsButton} from '../features/synergies/components/MechanicsButton';
import {Chip} from '../shared/components/Chip';
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
            gap: 8,
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

interface RoleConfig {
  getRoles: (card: LorcanaCard) => readonly string[];
  extraChips?: (cards: LorcanaCard[]) => RoleChip[];
  /** A tile's description; `mechanicDescription` unless the playstyle words a role its own way. */
  describe?: (mechanicId: string) => string;
}

/**
 * A classification tribe's tiles: its tribal roles, with While in Play and Trigger naming the
 * tribe (the catalog words those two for Location Control and Floodborns).
 */
function tribalConfig(spec: TribalSpec): RoleConfig {
  return {
    getRoles: (card) => getTribalRoles(card, spec).filter((r) => r !== 'member'),
    describe: (id) => tribalMechanicDescription(id, spec),
  };
}

/**
 * Per-playstyle structural-role DETECTORS only. Labels/descriptions are NOT here —
 * every tile's text comes from the one mechanics catalog (mechanicLabel/Description),
 * so the same mechanic reads identically in every playstyle; a tribe's two shared roles
 * name the tribe (`tribalConfig`). `member` is structural membership, not a displayed
 * mechanic, so it's filtered out. See MECHANICS_TAXONOMY.md.
 */
const ROLE_CONFIGS: Record<PlaystyleId, RoleConfig> = {
  'location-control': {
    getRoles: (card) => getLocationRoles(card),
    extraChips: (cards) => {
      const count = cards.filter((c) => c.type === 'Location').length;
      return count > 0
        ? [{role: LOCATION_CARD_ROLE, label: 'Locations', tooltip: 'Location cards', count}]
        : [];
    },
  },
  discard: {getRoles: (card) => getDiscardRoles(card)},
  'self-discard': {getRoles: (card) => getSelfDiscardRoles(card)},
  sacrifice: {getRoles: (card) => getSacrificeRoles(card)},
  ramp: {getRoles: (card) => getRampRoles(card)},
  'lore-denial': {getRoles: (card) => getLoreDenialRoles(card)},
  toy: {getRoles: (card) => getToyRoles(card).filter((r) => r !== 'member')},
  dwarfs: {getRoles: (card) => getDwarfsRoles(card).filter((r) => r !== 'member')},
  floodborn: {getRoles: (card) => getFloodbornRoles(card).filter((r) => r !== 'member')},
  hunny: {getRoles: (card) => getHunnyRoles(card).filter((r) => r !== 'member')},
  'red-panda': {getRoles: (card) => getRedPandaRoles(card).filter((r) => r !== 'member')},
  items: {getRoles: (card) => getItemRoles(card).filter((r) => r !== 'member')},
  healing: {getRoles: (card) => getHealRoles(card)},
  exert: {getRoles: (card) => getExertRoles(card)},
  bounce: {getRoles: (card) => getBounceRoles(card)},
  'ink-drops': {getRoles: (card) => getInkDropRoles(card)},
  monster: tribalConfig(TRIBAL_SPECS.monster),
  princess: tribalConfig(TRIBAL_SPECS.princess),
  hero: tribalConfig(TRIBAL_SPECS.hero),
  super: tribalConfig(TRIBAL_SPECS.super),
  royalty: tribalConfig(TRIBAL_SPECS.royalty),
  detective: tribalConfig(TRIBAL_SPECS.detective),
  gargoyle: tribalConfig(TRIBAL_SPECS.gargoyle),
  madrigal: tribalConfig(TRIBAL_SPECS.madrigal),
  villain: tribalConfig(TRIBAL_SPECS.villain),
};

/**
 * The canonical mechanic ids a card contributes to its playstyle's tiles: the
 * rule's structural roles (each canonicalised to its catalog twin, e.g.
 * `burn`→`lore-burn`) unioned with every generic catalog mechanic. Canonicalising
 * means a structural role and its catalog twin collapse to ONE id automatically;
 * labels are resolved from the catalog so a mechanic reads identically everywhere.
 */
function cardMechanicIds(config: RoleConfig, card: LorcanaCard): string[] {
  const ids = new Set<string>();
  for (const role of config.getRoles(card)) ids.add(STRUCTURAL_ROLE_TO_MECHANIC[role] ?? role);
  for (const id of getCardMechanics(card)) ids.add(id);
  return [...ids];
}

/**
 * Aggregate a playstyle's cards into deduped mechanic chips — one chip per
 * canonical mechanic id, counted across the cards, labelled from the catalog.
 */
function getRoleChips(playstyleId: PlaystyleId | undefined, cards: LorcanaCard[]): RoleChip[] {
  if (!playstyleId) return [];
  const config = ROLE_CONFIGS[playstyleId];
  if (!config) return [];
  const counts = new Map<string, number>();
  for (const card of cards) {
    for (const id of cardMechanicIds(config, card)) counts.set(id, (counts.get(id) ?? 0) + 1);
  }
  const extras = config.extraChips?.(cards) ?? [];
  const describe = config.describe ?? mechanicDescription;
  const chips = [...counts].map(([role, count]) => ({
    role,
    label: mechanicLabel(role),
    tooltip: describe(role),
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

/**
 * Check if a card has a specific role within its playstyle. Pass `precomputedIds`
 * (the card's canonical mechanic-id set) when checking many roles for the same
 * card to avoid recomputing the regex/role detection per role.
 */
function cardHasRole(
  playstyleId: PlaystyleId,
  card: LorcanaCard,
  role: string,
  precomputedIds?: ReadonlySet<string>,
): boolean {
  if (playstyleId === 'location-control' && role === LOCATION_CARD_ROLE) {
    return card.type === 'Location';
  }
  const config = ROLE_CONFIGS[playstyleId];
  if (!config) return false;
  // Match against the same canonical id set used to build the tiles.
  if (precomputedIds) return precomputedIds.has(role);
  return cardMechanicIds(config, card).includes(role);
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
): LorcanaCard[] {
  if (activeRoles.size === 0 || !playstyleId) return cards;
  const config = ROLE_CONFIGS[playstyleId];
  if (!config) return cards;
  const roles = [...activeRoles];
  return cards.filter((card) => {
    // Compute the card's mechanic-id set once, then test every active role against it.
    const ids = new Set(cardMechanicIds(config, card));
    return roles.some((r) => cardHasRole(playstyleId, card, r, ids));
  });
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

/** Default sort to ink-cost on mount (skipped if URL already has a sort param).
 * useEffect + ref guard: setSearchParams mutates URL (side effect), not state —
 * calling it during render violates React's purity model. */
function useDefaultSortParam() {
  const [searchParams, setSearchParams] = useSearchParams();
  const applied = useRef(false);
  useEffect(() => {
    if (applied.current) return;
    applied.current = true;
    if (searchParams.has('sort')) return;
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set('sort', 'ink-cost');
        return next;
      },
      {replace: true},
    );
  }, [searchParams, setSearchParams]);
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
  } = useFilterParams();
  const [showFilters, setShowFilters] = useState(false);
  const [activeRoles, setActiveRoles] = useState<Set<string>>(() => new Set());
  usePlaystyleNavReset(playstyleId, setActiveRoles);
  const toggleRole = (role: string) => setActiveRoles((prev) => toggleSetMember(prev, role));
  useDefaultSortParam();

  const {playstyle, ui} = useResolvedPlaystyle(playstyleId);
  const {cards: playstyleCards, ...playstyleCardsLoad} = usePrecomputedPlaystyleCards(playstyle?.id);
  const pageLoad = combineLoads({isLoading, error, retry: retryLoad}, playstyleCardsLoad);

  const combinedFilters = buildCombinedFilters(filters, inkFilters, typeFilters, costFilters);
  const sortedCards = applyFilterAndSort(playstyleCards, searchQuery, combinedFilters, sortOrder);
  const roleChips = getRoleChips(playstyle?.id, sortedCards);
  const roleFilteredCards = applyRoleFilter(sortedCards, activeRoles, playstyle?.id);
  const displayedCards = roleFilteredCards.slice(0, LAYOUT.maxDisplayedCards);

  const goHome = () => navigate('/');
  const goPlaystyles = () => navigate('/playstyles');
  const handleCardSelect = (card: {id: string}) => {
    trackCardSelected(getCardById(card.id), 'playstyle');
    openCardModal(card.id, displayedCards.map((c) => c.id));
  };

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
        roleChips={roleChips}
        activeRoles={activeRoles}
        toggleRole={toggleRole}
        clearRoles={() => setActiveRoles(new Set())}
        roleFilteredCards={roleFilteredCards}
        displayedCards={displayedCards}
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
      roleChips={roleChips}
      activeRoles={activeRoles}
      toggleRole={toggleRole}
      roleFilteredCards={roleFilteredCards}
      displayedCards={displayedCards}
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
 * The card data and the playstyles' lists as one load: loading while either is, and the
 * retry for whichever failed, the card data first, or null when both loaded.
 */
function combineLoads(
  cardData: PageLoad,
  playstyleCards: PageLoad,
): {isLoading: boolean; retry: (() => void) | null} {
  const failed = [cardData, playstyleCards].find((load) => load.error);
  return {isLoading: cardData.isLoading || playstyleCards.isLoading, retry: failed?.retry ?? null};
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
 * row's box, so the grid starts where it will (#914).
 */
function DesktopMechanicsRow({
  isLoading,
  roleChips,
  activeRoles,
  toggleRole,
}: {
  isLoading: boolean;
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
}) {
  if (!isLoading && roleChips.length === 0) return null;
  return (
    <div style={{padding: '32px 32px 0'}}>
      {isLoading ? (
        <RoleTileRowSkeleton />
      ) : (
        <RoleTileRow
          tiles={roleChips.map(toRoleTile)}
          activeRoles={activeRoles}
          onToggle={toggleRole}
          showDescriptions={false}
        />
      )}
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
  roleChips,
  activeRoles,
  toggleRole,
  clearRoles,
  roleFilteredCards,
  displayedCards,
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
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
  clearRoles: () => void;
  roleFilteredCards: LorcanaCard[];
  displayedCards: LorcanaCard[];
  toolbarProps: ToolbarProps;
  filterDialogProps: FilterDialogSharedProps;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);

  // Render MechanicsButton + active role chips into the toolbar's extraChips slot
  // so they sit alongside ink/cost filter chips instead of in a separate row. While the
  // cards load, the button holds its place, off.
  const toolbarExtras =
    isLoading || roleChips.length > 0 ? (
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
      </div>
      <FilterDialog {...filterDialogProps} variant="drawer" />
      <MechanicsBottomSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        tiles={roleChips.map(toRoleTile)}
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
  roleChips,
  activeRoles,
  toggleRole,
  roleFilteredCards,
  displayedCards,
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
  roleChips: RoleChip[];
  activeRoles: ReadonlySet<string>;
  toggleRole: (role: string) => void;
  roleFilteredCards: LorcanaCard[];
  displayedCards: LorcanaCard[];
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
          isLoading={isLoading}
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
      </div>
      <FilterDialog {...filterDialogProps} variant="modal" />
    </main>
  );
}
