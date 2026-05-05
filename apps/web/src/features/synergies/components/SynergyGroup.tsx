import {useState, useRef} from 'react';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData, SynergyMatchDisplay} from '../types';
import {SynergyCard} from './SynergyCard';
import {applySynergySortOrder} from '../utils';
import {COLORS, FONT_SIZES, LAYOUT, RADIUS, SPACING} from '../../../shared/constants';
import {AbilityCallout, AbilityTag} from '../../../shared/components';
import {useContainerWidth, useRovingTabIndex} from '../../../shared/hooks';

interface SynergyGroupProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  maxVisibleCards?: number;
  onShowAll?: (groupKey: string) => void;
  /** When false, hides the group header and description (used in show-all expanded view). Default: true */
  showHeader?: boolean;
  /** Minimum card width for desktop grid. Default: LAYOUT.synergyCardMinWidth (160px) */
  cardMinWidth?: number;
  /** When set, forces a fixed column count instead of the responsive auto-fill grid. */
  gridColumns?: number;
  /** Override grid gap (px). Default: 10 */
  gridGap?: number;
  /** Override the trailing margin between stacked groups. Default: SPACING.xl. Pass 0 when the parent uses flex `gap`. */
  marginBottom?: number;
  /** Compact MoreTile sizing for narrow grids (e.g. inside CardOverviewModal). Default false. */
  compactMoreTile?: boolean;
  onCardClick?: (card: LorcanaCard, groupKey?: string) => void;
}

export function SynergyGroup({
  group,
  isMobile = false,
  maxVisibleCards = 6,
  onShowAll,
  showHeader = true,
  cardMinWidth,
  gridColumns,
  gridGap,
  marginBottom = SPACING.xl,
  compactMoreTile = false,
  onCardClick,
}: SynergyGroupProps) {
  // Wrap onCardClick to inject this group's groupKey before bubbling up.
  // SynergyCard's onCardClick stays (card) => void; this group is the only place
  // that knows which group context the click came from (Option A calibration).
  const onCardClickWithGroupKey = onCardClick
    ? (card: LorcanaCard) => onCardClick(card, group.groupKey)
    : undefined;
  // Default sort: ink alphabetical, then cost ascending within each ink
  const sortedSynergies = applySynergySortOrder(group.synergies, 'ink-cost');

  const totalCount = sortedSynergies.length;
  const visibleCount = Math.min(maxVisibleCards, totalCount);
  const isTruncated = visibleCount < totalCount;

  return (
    <div data-group-key={group.groupKey} style={{marginBottom: `${marginBottom}px`}}>
      {showHeader && (
        <>
          {/* Lorcana ability box: stacked tag at top-left + cream callout below */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              marginBottom: `${SPACING.sm}px`,
            }}>
            <h3 style={{margin: 0, lineHeight: 1}}>
              <AbilityTag variant="stacked">{group.label}</AbilityTag>
            </h3>
            <div style={{alignSelf: 'stretch'}}>
              <AbilityCallout variant="stacked-after-tag">{group.description}</AbilityCallout>
            </div>
          </div>

          {/* Card-count meta — sits outside the cream box, muted */}
          <div
            style={{
              fontSize: `${FONT_SIZES.xs}px`,
              color: COLORS.textMuted,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              marginBottom: `${SPACING.sm}px`,
            }}>
            {isTruncated
              ? `${visibleCount} of ${totalCount} cards`
              : `${totalCount} card${totalCount !== 1 ? 's' : ''}`}
          </div>
        </>
      )}

      {/* Card grid */}
      <SynergyCardList
        synergies={sortedSynergies}
        isMobile={isMobile}
        maxVisibleCards={maxVisibleCards}
        groupKey={group.groupKey}
        onShowAll={onShowAll}
        cardMinWidth={cardMinWidth}
        gridColumns={gridColumns}
        gridGap={gridGap}
        compactMoreTile={compactMoreTile}
        onCardClick={onCardClickWithGroupKey}
      />
    </div>
  );
}

// MoreTile: dashed tile for overflowed cards
function MoreTile({
  count,
  onClick,
  isMobile,
  tabIndex,
  compact = false,
}: {
  count: number;
  onClick?: () => void;
  isMobile?: boolean;
  tabIndex?: number;
  /** Compact sizing for narrow grids (mockup `.mini-tile.more`: 13px / 9px). Default false → standard sizing. */
  compact?: boolean;
}) {
  const [hovered, setHovered] = useState(false);

  // Mockup `.mini-tile.more` uses 13px/700 for the count and 9px/500 uppercase for the label.
  const countFontSize = compact ? FONT_SIZES.sm : FONT_SIZES.xxl;
  const labelFontSize = compact ? 9 : FONT_SIZES.xs;
  const labelText = compact ? 'more' : 'more cards';

  return (
    <button
      data-testid="more-tile"
      data-roving-item
      tabIndex={tabIndex}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Show ${count} more cards`}
      style={{
        position: 'relative',
        borderRadius: `${compact ? RADIUS.sm + 1 : RADIUS.lg}px`,
        overflow: 'hidden',
        aspectRatio: '0.72',
        cursor: 'pointer',
        background: COLORS.surfaceAlt,
        border: `1px dashed ${hovered ? 'rgba(212, 175, 55, 0.35)' : '#444466'}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: compact ? '2px' : isMobile ? '4px' : '6px',
        width: '100%',
        padding: 0,
        transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
        transform: hovered ? 'scale(1.04) translateY(-3px)' : undefined,
        boxShadow: hovered ? '0 0 16px rgba(212, 175, 55, 0.15)' : undefined,
        fontFamily: 'inherit',
      }}>
      <span style={{fontSize: `${countFontSize}px`, fontWeight: 700, color: COLORS.primary500}}>
        +{count}
      </span>
      <span
        style={{
          fontSize: `${labelFontSize}px`,
          fontWeight: 500,
          color: COLORS.textMuted,
          textTransform: compact ? 'uppercase' : undefined,
          letterSpacing: compact ? '0.06em' : undefined,
        }}>
        {labelText}
      </span>
    </button>
  );
}

// Card list with overflow handling
interface SynergyCardListProps {
  synergies: SynergyMatchDisplay[];
  isMobile: boolean;
  maxVisibleCards: number;
  groupKey: string;
  onShowAll?: (groupKey: string) => void;
  cardMinWidth?: number;
  gridColumns?: number;
  gridGap?: number;
  compactMoreTile?: boolean;
  onCardClick?: (card: LorcanaCard) => void;
}

function SynergyCardList({
  synergies,
  isMobile,
  maxVisibleCards,
  groupKey,
  onShowAll,
  cardMinWidth = LAYOUT.synergyCardMinWidth,
  gridColumns,
  gridGap = 10,
  compactMoreTile = false,
  onCardClick,
}: SynergyCardListProps) {
  const visible = synergies.slice(0, maxVisibleCards);
  const remaining = synergies.length - visible.length;
  const listRef = useRef<HTMLUListElement>(null);
  const containerWidth = useContainerWidth(listRef);
  const columns = isMobile
    ? 3
    : gridColumns ??
      (containerWidth > 0
        ? Math.max(1, Math.floor((containerWidth + gridGap) / (cardMinWidth + gridGap)))
        : 3); // fallback before measurement
  const {handleKeyDown, getTabIndex} = useRovingTabIndex({
    itemCount: visible.length + (remaining > 0 ? 1 : 0),
    columns,
    containerRef: listRef,
  });
  const desktopTemplate = gridColumns
    ? `repeat(${gridColumns}, 1fr)`
    : `repeat(auto-fill, minmax(${cardMinWidth}px, 1fr))`;

  return (
    // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- roving tabindex container for keyboard grid navigation
    <ul
      ref={listRef}
      aria-label="Synergy cards"
      onKeyDown={handleKeyDown}
      style={{
        display: 'grid',
        gridTemplateColumns: isMobile ? 'repeat(3, 1fr)' : desktopTemplate,
        gap: `${gridGap}px`,
        listStyle: 'none',
        padding: 0,
        margin: 0,
      }}>
      {visible.map((synergy, i) => (
        <li key={synergy.card.id}>
          <SynergyCard
            card={synergy.card}
            score={synergy.score}
            explanation={synergy.explanation}
            isMobile={isMobile}
            onCardClick={onCardClick}
            tabIndex={getTabIndex(i)}
          />
        </li>
      ))}
      {remaining > 0 && (
        <li>
          <MoreTile
            count={remaining}
            onClick={() => onShowAll?.(groupKey)}
            isMobile={isMobile}
            compact={compactMoreTile}
            tabIndex={getTabIndex(visible.length)}
          />
        </li>
      )}
    </ul>
  );
}
