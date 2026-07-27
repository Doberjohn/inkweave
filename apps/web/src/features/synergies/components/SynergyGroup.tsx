import {useState, useRef} from 'react';
import {Link} from 'react-router-dom';
import type {LorcanaCard} from '../../cards';
import type {SynergyGroup as SynergyGroupData, SynergyMatchDisplay} from '../types';
import {SynergyCard} from './SynergyCard';
import {applySynergySortOrder} from '../utils';
import {COLORS, FONT_SIZES, LAYOUT, RADIUS, SPACING, type SynergySortOrder} from '../../../shared/constants';
import {AbilityCallout, AbilityTag} from '../../../shared/components';
import {useContainerWidth, useRovingTabIndex} from '../../../shared/hooks';

interface SynergyGroupProps {
  group: SynergyGroupData;
  isMobile?: boolean;
  maxVisibleCards?: number;
  onShowAll?: (groupKey: string) => void;
  /** When false, hides the group header and description (used in show-all expanded view). Default: true */
  showHeader?: boolean;
  /** When false, hides the muted "X of Y cards" meta line above the grid. Default: true */
  showCardCount?: boolean;
  /** Minimum card width for desktop grid. Default: LAYOUT.synergyCardMinWidth (160px) */
  cardMinWidth?: number;
  /** When set, forces a fixed column count instead of the responsive auto-fill grid. */
  gridColumns?: number;
  /** Override grid gap (px). Default: 10 */
  gridGap?: number;
  /** Override the trailing margin between stacked groups. Default: SPACING.xl. Pass 0 when the parent uses flex `gap`. */
  marginBottom?: number;
  /** Compact tile + MoreTile sizing for narrow grids (e.g. inside CardOverviewModal):
   *  neutral tile border, no "View details" hover cue, smaller corner radius, smaller MoreTile font. Default false. */
  compact?: boolean;
  /** Sort order for the cards within this group. Default 'ink-cost' (ink alphabetical, then cost).
   *  The card page threads the user's SortSelect choice through here; the modal uses the default. */
  sortOrder?: SynergySortOrder;
  /** When set, renders a crawlable link to the playstyle hub page in the group header (#498 Phase 3).
   *  The parent decides when to pass it (card page only, playstyle groups only); this component just
   *  renders the link if given an href, so it stays route-agnostic and its router-less stories pass. */
  playstyleHref?: string;
  onCardClick?: (card: LorcanaCard, groupKey?: string) => void;
}

export function SynergyGroup({
  group,
  isMobile = false,
  maxVisibleCards = 6,
  onShowAll,
  showHeader = true,
  showCardCount = true,
  cardMinWidth,
  gridColumns,
  gridGap,
  marginBottom = SPACING.xl,
  compact = false,
  sortOrder = 'ink-cost',
  playstyleHref,
  onCardClick,
}: SynergyGroupProps) {
  // Wrap onCardClick to inject this group's groupKey before bubbling up.
  // SynergyCard's onCardClick stays (card) => void; this group is the only place
  // that knows which group context the click came from (Option A calibration).
  const onCardClickWithGroupKey = onCardClick
    ? (card: LorcanaCard) => onCardClick(card, group.groupKey)
    : undefined;
  // Sort the group's cards by the requested order (default: ink alphabetical, then cost ascending).
  const sortedSynergies = applySynergySortOrder(group.synergies, sortOrder);

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

          {/* Crawlable internal link to the playstyle hub page (#498 Phase 3). Only rendered when the
              parent supplies an href (card page, playstyle groups) — the SEO edge card → archetype. */}
          {playstyleHref && (
            <Link
              to={playstyleHref}
              style={{
                display: 'inline-block',
                marginBottom: `${SPACING.sm}px`,
                color: COLORS.primary,
                fontSize: `${FONT_SIZES.sm}px`,
                fontWeight: 600,
                textDecoration: 'none',
              }}>
              View the {group.label} playstyle <span aria-hidden="true">→</span>
            </Link>
          )}

          {/* Card-count meta — sits outside the cream box, muted. Hidden in mockup-fidelity contexts (e.g. CardOverviewModal). */}
          {showCardCount && (
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
          )}
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
        compact={compact}
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
  const config = pickMoreTileConfig(compact);

  return (
    <button
      data-testid="more-tile"
      data-roving-item
      tabIndex={tabIndex}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-label={`Show ${count} more cards`}
      style={pickMoreTileButtonStyle({config, hovered, compact, isMobile})}>
      <span style={{fontSize: `${config.countFontSize}px`, fontWeight: 700, color: COLORS.primary500}}>
        +{count}
      </span>
      <span
        style={{
          fontSize: `${config.labelFontSize}px`,
          fontWeight: 500,
          color: COLORS.textMuted,
          textTransform: config.labelTextTransform,
          letterSpacing: config.labelLetterSpacing,
        }}>
        {config.labelText}
      </span>
    </button>
  );
}

interface MoreTileConfig {
  countFontSize: number;
  labelFontSize: number;
  labelText: string;
  borderRadius: number;
  labelTextTransform: 'uppercase' | undefined;
  labelLetterSpacing: string | undefined;
}

/** Single switch on `compact` returning the full visual config — replaces ten inline ternaries. */
function pickMoreTileConfig(compact: boolean): MoreTileConfig {
  if (compact) {
    return {
      countFontSize: FONT_SIZES.sm,
      labelFontSize: 9,
      labelText: 'more',
      borderRadius: RADIUS.sm + 1,
      labelTextTransform: 'uppercase',
      labelLetterSpacing: '0.06em',
    };
  }
  return {
    countFontSize: FONT_SIZES.xxl,
    labelFontSize: FONT_SIZES.xs,
    labelText: 'more cards',
    borderRadius: RADIUS.lg,
    labelTextTransform: undefined,
    labelLetterSpacing: undefined,
  };
}

interface MoreTileButtonStyleInput {
  config: MoreTileConfig;
  hovered: boolean;
  compact: boolean;
  isMobile?: boolean;
}

function pickMoreTileButtonStyle({config, hovered, compact, isMobile}: MoreTileButtonStyleInput): React.CSSProperties {
  return {
    position: 'relative',
    borderRadius: `${config.borderRadius}px`,
    overflow: 'hidden',
    aspectRatio: '0.72',
    cursor: 'pointer',
    background: COLORS.surfaceAlt,
    border: `1px dashed ${hovered ? 'rgba(212, 175, 55, 0.35)' : '#444466'}`,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: pickMoreTileGap(compact, isMobile),
    width: '100%',
    padding: 0,
    transition: 'transform 0.2s, box-shadow 0.2s, border-color 0.2s',
    transform: hovered ? 'scale(1.04) translateY(-3px)' : undefined,
    boxShadow: hovered ? '0 0 16px rgba(212, 175, 55, 0.15)' : undefined,
    fontFamily: 'inherit',
  };
}

function pickMoreTileGap(compact: boolean, isMobile?: boolean): string {
  if (compact) return '2px';
  if (isMobile) return '4px';
  return '6px';
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
  compact?: boolean;
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
  compact = false,
  onCardClick,
}: SynergyCardListProps) {
  const visible = synergies.slice(0, maxVisibleCards);
  const remaining = synergies.length - visible.length;
  const listRef = useRef<HTMLUListElement>(null);
  const containerWidth = useContainerWidth(listRef);
  // Column count for roving-tabindex arrow navigation ONLY — it must never feed
  // grid-template-columns. Deriving layout from `isMobile` made the prerendered HTML
  // (captured at 1280x720) lay out with desktop columns when a phone rendered it, which
  // is a large part of #532's mobile shift. The grid itself is now CSS-driven; this stays
  // in JS because keyboard navigation needs an actual number, and getting it wrong for one
  // frame costs nothing visible.
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
      className="synergy-card-grid"
      aria-label="Synergy cards"
      onKeyDown={handleKeyDown}
      style={
        {
          display: 'grid',
          // The wide-viewport template is passed as a custom property rather than applied
          // directly: index.css overrides it to 3 columns under the tablet breakpoint. The
          // value itself is viewport-INDEPENDENT, so the same markup lays out correctly
          // whether it was rendered by a phone or captured by the desktop prerender crawl
          // (#532). Do not reintroduce an `isMobile` ternary here.
          '--synergy-grid-columns': desktopTemplate,
          gap: `${gridGap}px`,
          listStyle: 'none',
          padding: 0,
          margin: 0,
        } as React.CSSProperties
      }>
      {visible.map((synergy, i) => (
        <li key={synergy.card.id}>
          <SynergyCard
            card={synergy.card}
            score={synergy.score}
            explanation={synergy.explanation}
            isMobile={isMobile}
            compact={compact}
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
            compact={compact}
            tabIndex={getTabIndex(visible.length)}
          />
        </li>
      )}
    </ul>
  );
}
