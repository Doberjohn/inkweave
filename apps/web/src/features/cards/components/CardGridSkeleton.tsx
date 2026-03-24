// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used after TODO(human) is implemented
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- used after TODO(human) is implemented
import {COLORS, LAYOUT, RADIUS, SPACING} from '../../../shared/constants';
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
}

const MIN_COL_WIDTH = LAYOUT.browseCardMinWidth;
const CARD_ASPECT = 0.72;
const DEFAULT_GAP = SPACING.md;

export function CardGridSkeleton({
  gap: gapProp,
  padding: paddingProp,
  columns: columnsProp,
  rows: rowCount = 3,
}: CardGridSkeletonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const containerWidth = useContainerWidth(containerRef);

  const gap = gapProp ?? DEFAULT_GAP;
  const containerPadding = paddingProp ?? `${SPACING.lg}px 32px 32px`;

  const columns = columnsProp ?? Math.max(1, Math.floor((containerWidth + gap) / (MIN_COL_WIDTH + gap)));
  const colWidth = containerWidth > 0 ? (containerWidth - gap * (columns - 1)) / columns : MIN_COL_WIDTH;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used after TODO(human) is implemented
  const cardHeight = colWidth / CARD_ASPECT;

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- used after TODO(human) is implemented
  const totalCards = columns * rowCount;

  // TODO(human): Implement the skeleton card grid rendering.
  // Use SkeletonTheme + Skeleton from react-loading-skeleton.
  // Each card should be a rounded rectangle matching cardHeight.
  // Theme colors: COLORS.surfaceAlt (base), COLORS.surfaceHover (highlight).
  // Border radius: RADIUS.card (12px).
  // The grid should use CSS grid with `columns` count and `gap`.
  // Wrap everything in the containerRef div with containerPadding.
  // Add aria-busy="true" and aria-label="Loading cards" for accessibility.
  return (
    <div
      ref={containerRef}
      style={{padding: containerPadding}}
      aria-busy="true"
      aria-label="Loading cards"
    >
      {containerWidth > 0 && (
        <div>Skeleton placeholder — implement me!</div>
      )}
    </div>
  );
}
