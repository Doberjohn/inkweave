import Skeleton from 'react-loading-skeleton';
import {LAYOUT, RADIUS, SPACING} from '../../../shared/constants';
import {InkCardPlaceholder} from 'inkweave-ui/lorcana/InkCardPlaceholder';
import {useContainerWidth} from 'inkweave-ui/hooks/useContainerWidth';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';
import {useRef} from 'react';

interface CardGridSkeletonProps {
  /** Override gap between cards (default: SPACING.md) */
  gap?: number;
  /**
   * The container's padding: pass the loaded grid's own, so the first tile starts where the
   * loaded grid's first tile does (default: none).
   */
  padding?: string;
  /** Force column count (bypasses dynamic calculation) */
  columns?: number;
  /** The loaded grid's column minimum, where it is not CardGrid's (Browse's phone grid). */
  minColWidth?: number;
  /** Number of skeleton rows to show (default: 3) */
  rows?: number;
  /** Width / height ratio of each placeholder (default: 0.72, matches Lorcana card portrait). Use >1 for landscape tiles. */
  aspectRatio?: number;
  /** aria-label for the loading region (default: "Loading cards") */
  ariaLabel?: string;
}

const DEFAULT_CARD_ASPECT = 0.72;
const DEFAULT_GAP = SPACING.md;

/**
 * The loading grid, sized as `CardGrid` and `BrowseCardGrid` size theirs (#914): the same
 * column minimum, CardGrid's for the viewport unless the caller passes its grid's own, so a
 * phone gets the loaded grid's columns, and tiles exactly as tall as a card of the column's
 * width.
 */
export function CardGridSkeleton({
  gap: gapProp,
  padding: paddingProp,
  columns: columnsProp,
  minColWidth: minColWidthProp,
  rows: rowCount = 3,
  aspectRatio = DEFAULT_CARD_ASPECT,
  ariaLabel = 'Loading cards',
}: CardGridSkeletonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);
  const {isMobile} = useResponsive();
  const minColWidth =
    minColWidthProp ?? (isMobile ? LAYOUT.cardGridMinWidthMobile : LAYOUT.cardGridMinWidth);

  const gap = gapProp ?? DEFAULT_GAP;
  const containerPadding = paddingProp ?? 0;

  const columns = columnsProp ?? Math.max(1, Math.floor((containerWidth + gap) / (minColWidth + gap)));
  const colWidth = containerWidth > 0 ? (containerWidth - gap * (columns - 1)) / columns : minColWidth;
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
            {Array.from({length: totalCards}, (_, i) =>
              // Card-shaped tiles are cards whose list is still loading: the neutral ink tile.
              // Any other shape (the playstyle gallery's banners) keeps the plain shimmer.
              aspectRatio === DEFAULT_CARD_ASPECT ? (
                <div
                  key={i}
                  style={{
                    position: 'relative',
                    height: cardHeight,
                    borderRadius: RADIUS.card,
                    overflow: 'hidden',
                  }}>
                  <InkCardPlaceholder />
                </div>
              ) : (
                <Skeleton key={i} height={cardHeight} borderRadius={RADIUS.card} />
              ),
            )}
          </div>
        </>
      )}
    </div>
  );
}
