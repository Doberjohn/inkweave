import {useEffect, useRef, useState} from 'react';
import {useParams, useNavigate, useSearchParams, Navigate} from 'react-router-dom';
import {
  getPlaystyleById,
  getLocationRoles,
  getDiscardRoles,
  getRampRoles,
  getLoreDenialRoles,
  getToyRoles,
  LOCATION_ROLE_CHIP_LABELS,
  LOCATION_ROLE_TOOLTIP,
  DISCARD_ROLE_CHIP_LABELS,
  DISCARD_ROLE_DESCRIPTIONS,
  RAMP_ROLE_CHIP_LABELS,
  RAMP_ROLE_DESCRIPTIONS,
  LORE_DENIAL_ROLE_CHIP_LABELS,
  LORE_DENIAL_ROLE_DESCRIPTIONS,
  TOY_ROLE_CHIP_LABELS,
  TOY_ROLE_DESCRIPTIONS,
  type PlaystyleId,
  type LorcanaCard,
  type LocationRole,
  type DiscardRole,
  type RampRole,
  type LoreDenialRole,
  type ToyRole,
} from 'inkweave-synergy-engine';
import {usePrecomputedPlaystyleCards} from '../features/synergies/hooks';
import {RoleTileRow, type RoleTile} from '../features/synergies/components/RoleTileRow';
import {MechanicsBottomSheet} from '../features/synergies/components/MechanicsBottomSheet';
import {MechanicsButton} from '../features/synergies/components/MechanicsButton';
import {Chip} from '../shared/components/Chip';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {BrowseToolbar, CardGrid, CardGridSkeleton} from '../features/cards';
import {filterCards, applySortOrder, type CardFilterOptions} from '../features/cards/loader';
import {
  CompactHeader,
  ErrorBoundary,
  EtherealBackground,
  FilterDialog,
} from '../shared/components';
import {
  COLORS,
  FONTS,
  FONT_SIZES,
  LAYOUT,
  RADIUS,
  SPACING,
  PLAYSTYLE_UI,
} from '../shared/constants';
import {useCardDataContext} from '../shared/contexts/CardDataContext';
import {useResponsive, useFilterParams, usePreloadImages} from '../shared/hooks';

// Feature flag: gates the "Strategy Tips" collapsible section on the hero.
// Off by default in production (set `VITE_SHOW_STRATEGY_TIPS=true` in .env.local for dev).
const SHOW_STRATEGY_TIPS = import.meta.env.VITE_SHOW_STRATEGY_TIPS === 'true';

// ── Hero layout configs ──

interface HeroLayout {
  padding: string;
  contentGap: number;
  headerGap: number;
  maxDescriptionWidth: number | undefined;
  breadcrumbLinkMinHeight: number | undefined;
  tipsMinHeight: number | undefined;
}

const HERO_DESKTOP: HeroLayout = {
  padding: '20px 32px',
  contentGap: 12,
  headerGap: 12,
  maxDescriptionWidth: 640,
  breadcrumbLinkMinHeight: undefined,
  tipsMinHeight: undefined,
};

const HERO_MOBILE: HeroLayout = {
  padding: '16px',
  contentGap: 10,
  headerGap: 10,
  maxDescriptionWidth: undefined,
  breadcrumbLinkMinHeight: 44,
  tipsMinHeight: 44,
};

// ── Hero scrim ──

const HERO_SCRIM =
  'linear-gradient(180deg, rgba(13,13,20,0.6) 0%, rgba(13,13,20,0.4) 50%, rgba(13,13,20,0.6) 100%)';

// ── Hero Section ──

function PlaystyleHero({
  name,
  description,
  tips,
  accentColor,
  accentRgb,
  coverArt,
  layout,
  onPlaystylesBreadcrumb,
}: {
  name: string;
  description: string;
  tips: string[];
  accentColor: string;
  accentRgb: string;
  coverArt: string;
  layout: HeroLayout;
  onPlaystylesBreadcrumb: () => void;
}) {
  const [tipsOpen, setTipsOpen] = useState(false);

  return (
    <section
      style={{
        position: 'relative',
        padding: layout.padding,
        overflow: 'hidden',
        borderBottom: `1px solid rgba(${accentRgb}, 0.25)`,
        boxShadow: `0 4px 20px rgba(${accentRgb}, 0.08)`,
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
      {/* Background art with Ken Burns */}
      <div
        className="hero-ken-burns"
        style={{
          position: 'absolute',
          inset: -20,
          zIndex: 1,
          backgroundSize: 'cover',
          backgroundPosition: 'center top',
          backgroundImage: `url(${coverArt})`,
          opacity: 0.4,
          filter: 'saturate(0.3) brightness(0.7)',
          animation: 'heroKenBurns 20s ease-in-out infinite alternate',
        }}
      />
      {/* Scrim */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 1,
          background: HERO_SCRIM,
          pointerEvents: 'none',
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
          <span style={{fontSize: `${FONT_SIZES.xs}px`, color: '#555570'}}>/</span>
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
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              margin: 0,
            }}>
            {name}
          </h1>
        </div>

        {/* Description */}
        <p
          style={{
            fontSize: `${FONT_SIZES.base}px`,
            lineHeight: 1.6,
            color: COLORS.descriptionText,
            maxWidth: layout.maxDescriptionWidth,
            margin: 0,
          }}>
          {description}
        </p>

        {/* Strategy Tips: collapsible section (hidden when no tips or when flag is off) */}
        {SHOW_STRATEGY_TIPS && tips.length > 0 && (
          <>
            <button
              onClick={() => setTipsOpen(!tipsOpen)}
              style={{
                fontSize: `${FONT_SIZES.base}px`,
                fontWeight: 500,
                color: COLORS.primary,
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                fontFamily: FONTS.body,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                minHeight: layout.tipsMinHeight,
                transition: 'opacity 0.15s',
              }}>
              <span
                style={{
                  fontSize: `${FONT_SIZES.xs}px`,
                  display: 'inline-block',
                  transform: tipsOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}>
                &#9654;
              </span>
              Strategy Tips
            </button>
            {tipsOpen && (
              <ul
                style={{
                  listStyle: 'none',
                  padding: `${SPACING.md}px ${SPACING.lg}px`,
                  background: `rgba(${accentRgb}, 0.08)`,
                  borderRadius: `${RADIUS.lg}px`,
                  border: `1px solid rgba(${accentRgb}, 0.15)`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  maxWidth: layout.maxDescriptionWidth,
                }}>
                {tips.map((tip, i) => (
                  <li
                    key={i}
                    style={{
                      fontSize: `${FONT_SIZES.base}px`,
                      lineHeight: 1.6,
                      color: COLORS.descriptionText,
                      paddingLeft: 16,
                      position: 'relative',
                    }}>
                    <span
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: accentColor,
                        fontWeight: 700,
                      }}>
                      ·
                    </span>
                    {tip}
                  </li>
                ))}
              </ul>
            )}
          </>
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
  getLabel: (role: string) => string;
  getTooltip: (role: string) => string;
  extraChips?: (cards: LorcanaCard[]) => RoleChip[];
}

const ROLE_CONFIGS: Partial<Record<PlaystyleId, RoleConfig>> = {
  'location-control': {
    getRoles: (card) => getLocationRoles(card),
    getLabel: (role) => LOCATION_ROLE_CHIP_LABELS[role as LocationRole],
    getTooltip: (role) => LOCATION_ROLE_TOOLTIP[role as LocationRole],
    extraChips: (cards) => {
      const count = cards.filter((c) => c.type === 'Location').length;
      return count > 0
        ? [{role: LOCATION_CARD_ROLE, label: 'Locations', tooltip: 'Location cards', count}]
        : [];
    },
  },
  discard: {
    getRoles: (card) => getDiscardRoles(card),
    getLabel: (role) => DISCARD_ROLE_CHIP_LABELS[role as DiscardRole],
    getTooltip: (role) => DISCARD_ROLE_DESCRIPTIONS[role as DiscardRole],
  },
  ramp: {
    getRoles: (card) => getRampRoles(card),
    getLabel: (role) => RAMP_ROLE_CHIP_LABELS[role as RampRole],
    getTooltip: (role) => RAMP_ROLE_DESCRIPTIONS[role as RampRole],
  },
  'lore-denial': {
    getRoles: (card) => getLoreDenialRoles(card),
    getLabel: (role) => LORE_DENIAL_ROLE_CHIP_LABELS[role as LoreDenialRole],
    getTooltip: (role) => LORE_DENIAL_ROLE_DESCRIPTIONS[role as LoreDenialRole],
  },
  toy: {
    // Hide 'member' from chips — it's used internally for playstyle membership but
    // doesn't add filter value as a chip (Type/classification filters handle that).
    getRoles: (card) => getToyRoles(card).filter((r) => r !== 'member'),
    getLabel: (role) => TOY_ROLE_CHIP_LABELS[role as ToyRole],
    getTooltip: (role) => TOY_ROLE_DESCRIPTIONS[role as ToyRole],
  },
};

/** Get role chip definitions for playstyles that have roles */
function getRoleChips(playstyleId: PlaystyleId | undefined, cards: LorcanaCard[]): RoleChip[] {
  if (!playstyleId) return [];
  const config = ROLE_CONFIGS[playstyleId];
  if (!config) return [];
  const roleCounts = new Map<string, number>();
  for (const card of cards) {
    for (const role of config.getRoles(card)) {
      roleCounts.set(role, (roleCounts.get(role) ?? 0) + 1);
    }
  }
  const extras = config.extraChips?.(cards) ?? [];
  const chips = [...roleCounts].map(([role, count]) => ({
    role,
    label: config.getLabel(role),
    tooltip: config.getTooltip(role),
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

/** Check if a card has a specific role within its playstyle */
function cardHasRole(playstyleId: PlaystyleId, card: LorcanaCard, role: string): boolean {
  if (playstyleId === 'location-control' && role === LOCATION_CARD_ROLE) {
    return card.type === 'Location';
  }
  const config = ROLE_CONFIGS[playstyleId];
  return config ? config.getRoles(card).includes(role) : false;
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
  inkFilters: CardFilterOptions['ink'] extends readonly (infer U)[] ? U[] : never,
  typeFilters: CardFilterOptions['type'] extends readonly (infer U)[] ? U[] : never,
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
  combinedFilters: CardFilterOptions,
  sortOrder: Parameters<typeof applySortOrder>[1],
): LorcanaCard[] {
  const filtered =
    Object.keys(combinedFilters).length > 0 ? filterCards(cards, combinedFilters) : cards;
  return applySortOrder(filtered, sortOrder);
}

function applyRoleFilter(
  cards: LorcanaCard[],
  activeRoles: ReadonlySet<string>,
  playstyleId: PlaystyleId | undefined,
): LorcanaCard[] {
  if (activeRoles.size === 0 || !playstyleId) return cards;
  const roles = [...activeRoles];
  return cards.filter((card) => roles.some((r) => cardHasRole(playstyleId, card, r)));
}

function getHeroLayout(isMobile: boolean): HeroLayout {
  return isMobile ? HERO_MOBILE : HERO_DESKTOP;
}

function buildSearchTarget(query: string): string {
  const q = query.trim();
  return q ? `/browse?q=${encodeURIComponent(q)}` : '/browse';
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
 */
function buildPlaystyleViewProps(args: {
  showFilters: boolean;
  setShowFilters: (open: boolean) => void;
  activeFilterCount: number;
  inkFilters: ToolbarProps['inkFilters'];
  typeFilters: ToolbarProps['typeFilters'];
  costFilters: ToolbarProps['costFilters'];
  filters: ToolbarProps['filters'];
  toggleInk: ToolbarProps['onToggleInk'];
  toggleType: ToolbarProps['onToggleType'];
  toggleCost: ToolbarProps['onToggleCost'];
  setFilters: ToolbarProps['onFiltersChange'];
  replaceFilters: FilterDialogSharedProps['onApply'];
  clearAllFilters: () => void;
  sortOrder: ToolbarProps['sortOrder'];
  setSortOrder: ToolbarProps['onSortChange'];
  uniqueKeywords: string[];
  uniqueClassifications: string[];
  sets: FilterDialogSharedProps['sets'];
}): {toolbarProps: ToolbarProps; filterDialogProps: FilterDialogSharedProps} {
  const toolbarProps: ToolbarProps = {
    onFiltersClick: () => args.setShowFilters(true),
    activeFilterCount: args.activeFilterCount,
    inkFilters: args.inkFilters,
    typeFilters: args.typeFilters,
    costFilters: args.costFilters,
    filters: args.filters,
    onToggleInk: args.toggleInk,
    onToggleType: args.toggleType,
    onToggleCost: args.toggleCost,
    onFiltersChange: args.setFilters,
    onClearAll: args.clearAllFilters,
    sortOrder: args.sortOrder,
    onSortChange: args.setSortOrder,
  };
  const filterDialogProps: FilterDialogSharedProps = {
    isOpen: args.showFilters,
    onClose: () => args.setShowFilters(false),
    onApply: args.replaceFilters,
    inkFilters: args.inkFilters,
    typeFilters: args.typeFilters,
    costFilters: args.costFilters,
    filters: args.filters,
    uniqueKeywords: args.uniqueKeywords,
    uniqueClassifications: args.uniqueClassifications,
    sets: args.sets,
  };
  return {toolbarProps, filterDialogProps};
}

function useResolvedPlaystyle(playstyleId: string | undefined) {
  const playstyle = playstyleId ? getPlaystyleById(playstyleId as PlaystyleId) : undefined;
  const ui = playstyleId ? PLAYSTYLE_UI[playstyleId as PlaystyleId] : undefined;
  usePreloadImages(ui ? [ui.coverArt] : []);
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
  const {isMobile} = useResponsive();
  const {cards, isLoading, error, retryLoad, uniqueKeywords, uniqueClassifications, sets} =
    useCardDataContext();
  const [headerSearchQuery, setHeaderSearchQuery] = useState('');
  const {
    inkFilters,
    toggleInk,
    typeFilters,
    toggleType,
    costFilters,
    toggleCost,
    filters,
    setFilters,
    replaceFilters,
    clearAllFilters,
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
  const {cards: playstyleCards} = usePrecomputedPlaystyleCards(playstyle?.id);

  const combinedFilters = buildCombinedFilters(filters, inkFilters, typeFilters, costFilters);
  const sortedCards = applyFilterAndSort(playstyleCards, combinedFilters, sortOrder);
  const roleChips = getRoleChips(playstyle?.id, sortedCards);
  const roleFilteredCards = applyRoleFilter(sortedCards, activeRoles, playstyle?.id);
  const displayedCards = roleFilteredCards.slice(0, LAYOUT.maxDisplayedCards);

  const goHome = () => navigate('/');
  const goPlaystyles = () => navigate('/playstyles');
  const handleCardSelect = (card: {id: string}) => navigate(`/card/${card.id}`);
  const handleSearchSubmit = () => navigate(buildSearchTarget(headerSearchQuery));

  // Still loading card data — show skeleton regardless of playstyle resolution.
  if (isLoading) {
    return (
      <PlaystyleDetailLoadingView
        isMobile={isMobile}
        cards={cards}
        goHome={goHome}
        headerSearchQuery={headerSearchQuery}
        setHeaderSearchQuery={setHeaderSearchQuery}
        handleSearchSubmit={handleSearchSubmit}
        handleCardSelect={handleCardSelect}
      />
    );
  }

  // Not loading, but playstyle ID is invalid — redirect to gallery.
  if (!playstyle || !ui) return <Navigate to="/playstyles" replace />;

  if (error) return <PlaystyleDetailError onRetry={retryLoad} />;

  const heroLayout = getHeroLayout(isMobile);
  const {toolbarProps, filterDialogProps} = buildPlaystyleViewProps({
    showFilters,
    setShowFilters,
    activeFilterCount,
    inkFilters,
    typeFilters,
    costFilters,
    filters,
    toggleInk,
    toggleType,
    toggleCost,
    setFilters,
    replaceFilters,
    clearAllFilters,
    sortOrder,
    setSortOrder,
    uniqueKeywords,
    uniqueClassifications,
    sets,
  });

  if (isMobile) {
    return (
      <PlaystyleDetailMobileView
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
      playstyle={playstyle}
      ui={ui}
      heroLayout={heroLayout}
      goHome={goHome}
      goPlaystyles={goPlaystyles}
      handleCardSelect={handleCardSelect}
      cards={cards}
      headerSearchQuery={headerSearchQuery}
      setHeaderSearchQuery={setHeaderSearchQuery}
      handleSearchSubmit={handleSearchSubmit}
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

// ── Page sub-views (extracted to keep PlaystyleDetailPage under CC 10) ──

type ResolvedPlaystyle = NonNullable<ReturnType<typeof getPlaystyleById>>;
type PlaystyleUIValue = (typeof PLAYSTYLE_UI)[PlaystyleId];

interface ToolbarProps {
  onFiltersClick: () => void;
  activeFilterCount: number;
  inkFilters: Parameters<typeof BrowseToolbar>[0]['inkFilters'];
  typeFilters: Parameters<typeof BrowseToolbar>[0]['typeFilters'];
  costFilters: Parameters<typeof BrowseToolbar>[0]['costFilters'];
  filters: Parameters<typeof BrowseToolbar>[0]['filters'];
  onToggleInk: Parameters<typeof BrowseToolbar>[0]['onToggleInk'];
  onToggleType: Parameters<typeof BrowseToolbar>[0]['onToggleType'];
  onToggleCost: Parameters<typeof BrowseToolbar>[0]['onToggleCost'];
  onFiltersChange: Parameters<typeof BrowseToolbar>[0]['onFiltersChange'];
  onClearAll: () => void;
  sortOrder: Parameters<typeof BrowseToolbar>[0]['sortOrder'];
  onSortChange: Parameters<typeof BrowseToolbar>[0]['onSortChange'];
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
  sets: Parameters<typeof FilterDialog>[0]['sets'];
}

function PlaystyleDetailLoadingView({
  isMobile,
  cards,
  goHome,
  headerSearchQuery,
  setHeaderSearchQuery,
  handleSearchSubmit,
  handleCardSelect,
}: {
  isMobile: boolean;
  cards: LorcanaCard[];
  goHome: () => void;
  headerSearchQuery: string;
  setHeaderSearchQuery: (q: string) => void;
  handleSearchSubmit: () => void;
  handleCardSelect: (card: {id: string}) => void;
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
      <EtherealBackground />
      <CompactHeader
        onLogoClick={goHome}
        searchQuery={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        cards={cards}
        onCardSelect={handleCardSelect}
        isMobile={isMobile}
      />
      <div style={{flex: 1, position: 'relative', zIndex: 1}}>
        <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
          <div
            style={{
              padding: isMobile ? SPACING.lg : '20px 32px',
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.md,
            }}
            aria-busy="true"
            aria-label="Loading playstyle detail">
            <Skeleton width={140} height={14} borderRadius={RADIUS.sm} />
            <Skeleton width="45%" height={32} borderRadius={RADIUS.sm} />
            <div style={{display: 'flex', flexDirection: 'column', gap: 6, maxWidth: 640}}>
              <Skeleton height={12} width="95%" borderRadius={RADIUS.sm} />
              <Skeleton height={12} width="88%" borderRadius={RADIUS.sm} />
              <Skeleton height={12} width="60%" borderRadius={RADIUS.sm} />
            </div>
          </div>
        </SkeletonTheme>
        <CardGridSkeleton
          rows={3}
          columns={isMobile ? 3 : undefined}
          gap={isMobile ? 10 : 12}
          padding={isMobile ? `${SPACING.lg}px` : '16px 32px 48px'}
          ariaLabel="Loading playstyle cards"
        />
      </div>
    </main>
  );
}

function PlaystyleDetailError({onRetry}: {onRetry: () => void}) {
  return (
    <div style={centeredPage}>
      <p style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
        Failed to load card data.
      </p>
      <button
        onClick={onRetry}
        style={{
          padding: '8px 20px',
          background: COLORS.primary,
          color: COLORS.background,
          border: 'none',
          borderRadius: 6,
          cursor: 'pointer',
          fontFamily: FONTS.body,
          fontWeight: 600,
        }}>
        Retry
      </button>
    </div>
  );
}

function CardGridOrEmpty({
  cards,
  displayedCards,
  handleCardSelect,
  padding,
  borderRadius,
}: {
  cards: LorcanaCard[];
  displayedCards: LorcanaCard[];
  handleCardSelect: (card: LorcanaCard) => void;
  padding: string;
  borderRadius?: number;
}) {
  return (
    <div style={{padding}}>
      <CardGrid
        cards={displayedCards}
        onSelect={handleCardSelect}
        variant="minimal"
        borderRadius={borderRadius}
        emptyMessage={cards.length === 0 ? 'No cards match your filters.' : undefined}
      />
    </div>
  );
}

function PlaystyleDetailMobileView({
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
  // so they sit alongside ink/cost filter chips instead of in a separate row.
  const toolbarExtras =
    roleChips.length > 0 ? (
      <>
        <MechanicsButton
          onClick={() => setSheetOpen(true)}
          activeCount={activeRoles.size}
          isMobile
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
      <EtherealBackground />
      <CompactHeader onLogoClick={goHome} isMobile />
      <div style={{position: 'relative', zIndex: 1}}>
        <PlaystyleHero
          name={playstyle.name}
          description={playstyle.description}
          tips={playstyle.strategyTips}
          accentColor={ui.accentColor}
          accentRgb={ui.accentRgb}
          coverArt={ui.coverArt}
          layout={heroLayout}
          onPlaystylesBreadcrumb={goPlaystyles}
        />
        <BrowseToolbar {...toolbarProps} isMobile extraChips={toolbarExtras} />
        <ErrorBoundary>
          <CardGridOrEmpty
            cards={roleFilteredCards}
            displayedCards={displayedCards}
            handleCardSelect={handleCardSelect}
            padding={`${SPACING.md}px ${SPACING.lg}px 48px`}
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
  playstyle,
  ui,
  heroLayout,
  goHome,
  goPlaystyles,
  handleCardSelect,
  cards,
  headerSearchQuery,
  setHeaderSearchQuery,
  handleSearchSubmit,
  roleChips,
  activeRoles,
  toggleRole,
  roleFilteredCards,
  displayedCards,
  toolbarProps,
  filterDialogProps,
}: {
  playstyle: ResolvedPlaystyle;
  ui: PlaystyleUIValue;
  heroLayout: HeroLayout;
  goHome: () => void;
  goPlaystyles: () => void;
  handleCardSelect: (card: {id: string}) => void;
  cards: LorcanaCard[];
  headerSearchQuery: string;
  setHeaderSearchQuery: (q: string) => void;
  handleSearchSubmit: () => void;
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
      <EtherealBackground />
      <CompactHeader
        onLogoClick={goHome}
        searchQuery={headerSearchQuery}
        onSearchChange={setHeaderSearchQuery}
        onSearchSubmit={handleSearchSubmit}
        cards={cards}
        onCardSelect={handleCardSelect}
      />
      <div
        style={{
          flex: 1,
          minHeight: `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
          position: 'relative',
          zIndex: 1,
        }}>
        <PlaystyleHero
          name={playstyle.name}
          description={playstyle.description}
          tips={playstyle.strategyTips}
          accentColor={ui.accentColor}
          accentRgb={ui.accentRgb}
          coverArt={ui.coverArt}
          layout={heroLayout}
          onPlaystylesBreadcrumb={goPlaystyles}
        />
        <BrowseToolbar {...toolbarProps} isMobile={false} />
        {roleChips.length > 0 && (
          <div style={{padding: '32px 32px 0'}}>
            <RoleTileRow
              tiles={roleChips.map(toRoleTile)}
              activeRoles={activeRoles}
              onToggle={toggleRole}
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
        )}
        <ErrorBoundary>
          <CardGridOrEmpty
            cards={roleFilteredCards}
            displayedCards={displayedCards}
            handleCardSelect={handleCardSelect}
            padding="24px 32px 48px"
          />
        </ErrorBoundary>
      </div>
      <FilterDialog {...filterDialogProps} variant="modal" />
    </main>
  );
}
