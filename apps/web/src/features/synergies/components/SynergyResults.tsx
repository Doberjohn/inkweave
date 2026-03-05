import {useState, useMemo, memo} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData} from '../types';
import {CardDetail, SynergyGroup} from '.';
import {ExpandedGroupView} from './ExpandedGroupView';
import {chipStyle} from '../utils';
import {EmptyState} from '../../../shared/components';
import {COLORS, FONTS, FONT_SIZES, SPACING, RADIUS, LAYOUT} from '../../../shared/constants';

interface SynergyResultsProps {
  selectedCard: LorcanaCard | null;
  synergies: SynergyGroupData[];
  totalSynergyCount: number;
  onClearSelection: () => void;
  isMobile?: boolean;
  /** When false, CardDetail is rendered externally (e.g. CardDetailPanel). Default: true for mobile. */
  showCardDetail?: boolean;
  /** Controlled group filter — when provided, overrides internal state */
  activeGroupFilter?: string | null;
  /** Callback when group filter changes — required when activeGroupFilter is controlled */
  onGroupFilterChange?: (groupKey: string | null) => void;
  /** When set, render single-group expanded view instead of multi-group list */
  expandedGroup?: string | null;
  /** Called when user clicks "+N more" tile on a group */
  onShowAll?: (groupKey: string) => void;
  /** Called when user clicks "← Back to all synergies" in expanded view */
  onBackToAll?: () => void;
  /** Called when a synergy card tile is clicked (opens detail modal) */
  onSynergyCardClick?: (card: LorcanaCard) => void;
}

type SortOrder =
  | 'strength-desc'
  | 'strength-asc'
  | 'name-asc'
  | 'name-desc'
  | 'cost-asc'
  | 'cost-desc';

export const SynergyResults = memo(function SynergyResults({
  selectedCard,
  synergies,
  totalSynergyCount,
  onClearSelection,
  isMobile = false,
  showCardDetail,
  activeGroupFilter: controlledFilter,
  onGroupFilterChange,
  expandedGroup,
  onShowAll,
  onBackToAll,
  onSynergyCardClick,
}: SynergyResultsProps) {
  // Default: show card detail on mobile, hide on desktop (it's in its own panel)
  const renderCardDetail = showCardDetail ?? isMobile;
  const [internalFilter, setInternalFilter] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>('strength-desc');

  // Find the expanded group data when in show-all mode
  const expandedGroupData = expandedGroup
    ? synergies.find((g) => g.groupKey === expandedGroup)
    : null;

  // Support both controlled (from CardPage) and uncontrolled (standalone) modes
  const activeGroupFilter = controlledFilter !== undefined ? controlledFilter : internalFilter;
  const setActiveGroupFilter = onGroupFilterChange ?? setInternalFilter;

  const sortedGroups = useMemo(() => {
    const filtered = activeGroupFilter
      ? synergies.filter((g) => g.groupKey === activeGroupFilter)
      : synergies;

    return filtered.map((group) => ({
      ...group,
      synergies: [...group.synergies].sort((a, b) => {
        switch (sortOrder) {
          case 'strength-desc':
            return b.score - a.score;
          case 'strength-asc':
            return a.score - b.score;
          case 'name-asc':
            return a.card.fullName.localeCompare(b.card.fullName);
          case 'name-desc':
            return b.card.fullName.localeCompare(a.card.fullName);
          case 'cost-asc':
            return a.card.cost - b.card.cost;
          case 'cost-desc':
            return b.card.cost - a.card.cost;
          default:
            return 0;
        }
      }),
    }));
  }, [synergies, activeGroupFilter, sortOrder]);

  return (
    <section
      aria-label="Synergy results"
      style={{
        flex: 1,
        padding: isMobile ? `${SPACING.md}px` : `${SPACING.xl}px`,
        overflowY: 'auto',
        maxHeight: isMobile ? '100vh' : `calc(100vh - ${LAYOUT.compactHeaderHeight}px)`,
        background: isMobile ? COLORS.background : undefined,
      }}>
      {!selectedCard ? (
        <EmptyState
          title="Select a card to see synergies"
          subtitle='Try "Elsa" or filter by Amethyst'
        />
      ) : expandedGroupData && onBackToAll ? (
        <ExpandedGroupView
          key={expandedGroupData.groupKey}
          group={expandedGroupData}
          isMobile={isMobile}
          onBackToAll={onBackToAll}
          onCardClick={onSynergyCardClick}
        />
      ) : (
        <>
          {renderCardDetail && <CardDetail card={selectedCard} onClear={onClearSelection} />}

          {synergies.length === 0 ? (
            <div
              role="status"
              aria-live="polite"
              style={{
                textAlign: 'center',
                padding: `${SPACING.xxl * 2}px`,
                color: COLORS.gray400,
              }}>
              <p>No synergies found for this card.</p>
              <p style={{fontSize: `${FONT_SIZES.base}px`, marginTop: `${SPACING.sm}px`}}>
                Try a card with Singer, Shift, Evasive, or Bodyguard.
              </p>
            </div>
          ) : (
            <>
              {/* Header */}
              <div
                aria-live="polite"
                aria-atomic="true"
                data-testid="synergy-header"
                style={{
                  marginBottom: `${SPACING.lg}px`,
                  display: 'flex',
                  alignItems: 'center',
                  gap: `${SPACING.sm}px`,
                }}>
                <h2
                  style={{
                    fontSize: `${FONT_SIZES.xl}px`,
                    fontWeight: 700,
                    color: COLORS.text,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    margin: 0,
                  }}>
                  Synergies
                </h2>
                <span
                  style={{
                    background: COLORS.calloutBg,
                    color: COLORS.primary,
                    padding: '2px 8px',
                    borderRadius: `${RADIUS.sm}px`,
                    fontSize: `${FONT_SIZES.xs}px`,
                    fontWeight: 700,
                    minWidth: 20,
                    textAlign: 'center',
                  }}>
                  {totalSynergyCount}
                </span>
              </div>

              {/* Toolbar: group chips + sort */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  marginBottom: `${SPACING.lg}px`,
                  ...(isMobile
                    ? {
                        overflowX: 'auto',
                        flexWrap: 'nowrap',
                        paddingBottom: '4px',
                        WebkitOverflowScrolling: 'touch',
                        scrollbarWidth: 'none',
                      }
                    : {flexWrap: 'wrap'}),
                }}>
                <button
                  onClick={() => setActiveGroupFilter(null)}
                  style={chipStyle(activeGroupFilter === null, isMobile)}>
                  All
                </button>
                {synergies.map((group) => (
                  <button
                    key={group.groupKey}
                    onClick={() => setActiveGroupFilter(group.groupKey)}
                    style={chipStyle(activeGroupFilter === group.groupKey, isMobile)}>
                    {group.label}
                  </button>
                ))}
                {!isMobile && (
                  <select
                    aria-label="Sort synergies"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                    style={{
                      marginLeft: 'auto',
                      padding: '5px 10px',
                      borderRadius: `${RADIUS.md}px`,
                      border: `1px solid ${COLORS.surfaceBorder}`,
                      background: COLORS.sortBg,
                      color: COLORS.text,
                      fontFamily: FONTS.body,
                      fontSize: `${FONT_SIZES.base}px`,
                      cursor: 'pointer',
                      outline: 'none',
                    }}>
                    <option value="strength-desc">Strength: High → Low</option>
                    <option value="strength-asc">Strength: Low → High</option>
                    <option value="name-asc">Name A–Z</option>
                    <option value="name-desc">Name Z–A</option>
                    <option value="cost-asc">Cost: Low → High</option>
                    <option value="cost-desc">Cost: High → Low</option>
                  </select>
                )}
              </div>

              {/* Groups */}
              {sortedGroups.map((group) => (
                <SynergyGroup
                  key={group.groupKey}
                  group={group}
                  isMobile={isMobile}
                  maxVisibleCards={isMobile ? 5 : 10}
                  onShowAll={onShowAll}
                  onCardClick={onSynergyCardClick}
                />
              ))}
            </>
          )}
        </>
      )}
    </section>
  );
});
