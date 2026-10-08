import type {CSSProperties} from 'react';
import Skeleton from 'react-loading-skeleton';
import {COLORS, LAYOUT, RADIUS, SPACING} from '../../../shared/constants';

interface SynergyResultsSkeletonProps {
  isMobile: boolean;
}

const GROUP_COUNT = 2;
// One desktop row, two mobile rows (the grid is 3 columns under the tablet breakpoint).
const TILES_PER_GROUP = 6;
const CHIP_WIDTHS = [44, 112, 96];
// Same template as SynergyGroup's grid; index.css's .synergy-card-grid narrows it on mobile.
const GRID_COLUMNS = `repeat(auto-fill, minmax(${LAYOUT.synergyCardMinWidth}px, 1fr))`;

/** "Synergies" title + count badge (SynergyResultsHeader). */
function HeaderSkeleton() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: `${SPACING.sm}px`,
        marginBottom: `${SPACING.lg}px`,
      }}>
      <Skeleton width={110} height={20} borderRadius={RADIUS.sm} />
      <Skeleton width={28} height={18} borderRadius={RADIUS.sm} />
    </div>
  );
}

/** Group filter chips, plus the sort select on desktop (SynergyGroupToolbar). */
function ToolbarSkeleton({isMobile}: SynergyResultsSkeletonProps) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        marginBottom: `${SPACING.lg}px`,
      }}>
      {CHIP_WIDTHS.map((width) => (
        <Skeleton key={width} width={width} height={isMobile ? 34 : 30} borderRadius={RADIUS.pill} />
      ))}
      {!isMobile && (
        <div style={{marginLeft: 'auto'}}>
          <Skeleton width={150} height={34} borderRadius={RADIUS.md} />
        </div>
      )}
    </div>
  );
}

/** One SynergyGroup: label tag, description callout, card count, then a row of card tiles. */
function GroupSkeleton() {
  return (
    <div style={{marginBottom: `${SPACING.xl}px`}}>
      <Skeleton width={96} height={24} borderRadius={RADIUS.sm} />
      <div style={{marginBottom: `${SPACING.sm}px`}}>
        <Skeleton height={40} borderRadius={RADIUS.sm} />
      </div>
      <div style={{marginBottom: `${SPACING.sm}px`}}>
        <Skeleton width={72} height={12} borderRadius={RADIUS.xs} />
      </div>
      <ul
        className="synergy-card-grid"
        style={
          {
            display: 'grid',
            '--synergy-grid-columns': GRID_COLUMNS,
            gap: '10px',
            listStyle: 'none',
            padding: 0,
            margin: 0,
          } as CSSProperties
        }>
        {Array.from({length: TILES_PER_GROUP}).map((_, i) => (
          <li key={i} style={{aspectRatio: '0.72'}}>
            <div
              className="inkweave-shimmer-tile"
              style={{
                borderRadius: `${RADIUS.lg}px`,
                background: `linear-gradient(110deg, ${COLORS.surfaceAlt} 0%, ${COLORS.surfaceHover} 50%, ${COLORS.surfaceAlt} 100%)`,
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The card page's synergy column while the card's synergy JSON is in flight
 * (usePrecomputedSynergies.isLoading). It mirrors the loaded layout, so the page does not
 * show "No synergies found" for a card that has synergies until its request settles.
 */
export function SynergyResultsSkeleton({isMobile}: SynergyResultsSkeletonProps) {
  return (
    <div data-testid="synergy-results-loading" aria-busy="true" aria-label="Loading synergies">
      <HeaderSkeleton />
      <ToolbarSkeleton isMobile={isMobile} />
      {Array.from({length: GROUP_COUNT}).map((_, i) => (
        <GroupSkeleton key={i} />
      ))}
    </div>
  );
}
