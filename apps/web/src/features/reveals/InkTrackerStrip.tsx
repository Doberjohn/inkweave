import type {Ink} from 'inkweave-synergy-engine';
import {InkTrackerTile} from './InkTrackerTile';

interface InkTrackerStripProps {
  /** Per-ink counts in display order (ALL_INKS). */
  inks: {ink: Ink; count: number}[];
  selected: Ink;
  onSelect: (ink: Ink) => void;
  /** Mobile sizing: fixed 2 columns instead of auto-fit. */
  compact?: boolean;
}

/**
 * The six ink tracker tiles. Wraps responsively (auto-fit on desktop, a fixed
 * 2-column grid on mobile); the selected tile features its ink's board below.
 */
export function InkTrackerStrip({inks, selected, onSelect, compact = false}: InkTrackerStripProps) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: compact ? 'repeat(2, 1fr)' : 'repeat(auto-fit, minmax(150px, 1fr))',
        gap: compact ? 10 : 12,
      }}
    >
      {inks.map(({ink, count}) => (
        <InkTrackerTile
          key={ink}
          ink={ink}
          count={count}
          selected={ink === selected}
          onSelect={onSelect}
          compact={compact}
        />
      ))}
    </div>
  );
}
