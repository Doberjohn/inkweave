import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {COLORS, RADIUS, SPACING} from '../../../shared/constants';

interface VoteFormSkeletonProps {
  /** Number of dimension-row placeholders (default: 6, matches InDepthVoteForm) */
  rows?: number;
  /** aria-label for the loading region (default: "Loading vote form") */
  ariaLabel?: string;
}

/**
 * Skeleton placeholder mirroring InDepthVoteForm's layout: N dimension rows,
 * each with a short label and a wider picker/track block. Used in the loading
 * branch of InDepthVotePage so the right column stays in place while data loads.
 */
export function VoteFormSkeleton({
  rows = 6,
  ariaLabel = 'Loading vote form',
}: VoteFormSkeletonProps) {
  return (
    <div
      style={{
        padding: SPACING.lg,
        display: 'flex',
        flexDirection: 'column',
        gap: SPACING.xl,
        width: '100%',
        boxSizing: 'border-box',
      }}
      aria-busy="true"
      aria-label={ariaLabel}>
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        {Array.from({length: rows}, (_, i) => (
          <div key={i} style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
            <Skeleton height={14} width="40%" borderRadius={RADIUS.sm} />
            <Skeleton height={44} borderRadius={RADIUS.md} />
          </div>
        ))}
      </SkeletonTheme>
    </div>
  );
}
