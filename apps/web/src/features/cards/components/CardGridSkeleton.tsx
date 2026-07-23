import Skeleton from 'react-loading-skeleton';
import {LAYOUT, RADIUS, SPACING} from '../../../shared/constants';
import {useContainerWidth} from '../../../shared/hooks/useContainerWidth';
import {useRef} from 'react';

interface CardGridSkeletonProps {
  /** Override gap between cards (default: SPACING.md) */
  gap?: number;
  /** Override container padding */
  padding?: string;
  /** Force column count (bypasses dynamic calculation) */
  columns?: number;
  /** Number of skeleton rows to show (default: 3) */
  rows?: number;
  /** Width / height ratio of each placeholder (default: 0.72, matches Lorcana card portrait). Use >1 for landscape tiles. */
  aspectRatio?: number;
  /** aria-label for the loading region (default: "Loading cards") */
  ariaLabel?: string;
}

const MIN_COL_WIDTH = LAYOUT.cardGridMinWidth;
const DEFAULT_CARD_ASPECT = 0.72;
const DEFAULT_GAP = SPACING.md;

export function CardGridSkeleton({
  gap: gapProp,
  padding: paddingProp,
  columns: columnsProp,
  rows: rowCount = 3,
  aspectRatio = DEFAULT_CARD_ASPECT,
  ariaLabel = 'Loading cards',
}: CardGridSkeletonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const gap = gapProp ?? DEFAULT_GAP;
  const containerPadding = paddingProp ?? `${SPACING.lg}px 32px 32px`;

  const columns = columnsProp ?? Math.max(1, Math.floor((containerWidth + gap) / (MIN_COL_WIDTH + gap)));
  const colWidth = containerWidth > 0 ? (containerWidth - gap * (columns - 1)) / columns : MIN_COL_WIDTH;
  const cardHeight = colWidth / aspectRatio;

  const totalCards = columns * rowCount;

  return (
    <div
      ref={containerRef}
      style={{padding: containerPadding}}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {containerWidth > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${columns}, 1fr)`,
            gap,
          }}>
            {Array.from({length: totalCards}, (_, i) => (
              <Skeleton key={i} height={cardHeight} borderRadius={RADIUS.card} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
