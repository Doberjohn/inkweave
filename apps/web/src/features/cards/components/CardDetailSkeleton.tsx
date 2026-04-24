import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {COLORS, RADIUS, SPACING} from '../../../shared/constants';

interface CardDetailSkeletonProps {
  /** Card image width (default: 298, matches CardDetailPanel's image) */
  imageWidth?: number;
  /** Image aspect ratio (default: 0.72, Lorcana card portrait) */
  aspectRatio?: number;
  /** Number of thin text-line skeletons below name/meta (default: 5) */
  textLines?: number;
  /** Container width (default: '100%' — stretches to parent). Pass a number for a fixed width. */
  width?: number | string;
  /** aria-label for the loading region (default: "Loading card detail") */
  ariaLabel?: string;
}

export function CardDetailSkeleton({
  imageWidth = 298,
  aspectRatio = 0.72,
  textLines = 5,
  width = '100%',
  ariaLabel = 'Loading card detail',
}: CardDetailSkeletonProps) {
  const imageHeight = imageWidth / aspectRatio;

  return (
    <div
      style={{
        width,
        padding: SPACING.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.lg,
        boxSizing: 'border-box',
      }}
      aria-busy="true"
      aria-label={ariaLabel}>
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <div style={{display: 'flex', justifyContent: 'center'}}>
          <Skeleton width={imageWidth} height={imageHeight} borderRadius={RADIUS.xl} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
          <Skeleton height={28} width="70%" borderRadius={RADIUS.sm} />
          <Skeleton height={16} width="50%" borderRadius={RADIUS.sm} />
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
          {Array.from({length: textLines}, (_, i) => (
            <Skeleton
              key={i}
              height={12}
              width={i === textLines - 1 ? '60%' : '100%'}
              borderRadius={RADIUS.sm}
            />
          ))}
        </div>
      </SkeletonTheme>
    </div>
  );
}
