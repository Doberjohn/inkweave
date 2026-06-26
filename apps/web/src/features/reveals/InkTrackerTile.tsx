import type {Ink} from 'inkweave-synergy-engine';
import {INK_COLORS, EASING} from '../../shared/constants';
import {PER_INK} from './setComposition';
import {ProgressRing} from './ProgressRing';
import {inkRgba} from './inkTint';

interface InkTrackerTileProps {
  ink: Ink;
  count: number;
  selected: boolean;
  onSelect: (ink: Ink) => void;
  /** Mobile sizing: 64px ring instead of 82px. */
  compact?: boolean;
}

/**
 * A selectable tracker tile: the ink's progress ring over its name and
 * `count / 34` (or a gold "Complete" at 34). Selecting it features that ink's
 * board below; the selected tile gets an ink-tinted border + glow.
 */
export function InkTrackerTile({ink, count, selected, onSelect, compact = false}: InkTrackerTileProps) {
  const done = count >= PER_INK;
  return (
    <button
      type="button"
      onClick={() => onSelect(ink)}
      aria-pressed={selected}
      style={{
        cursor: 'pointer',
        appearance: 'none',
        textAlign: 'center',
        font: 'inherit',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: compact ? 7 : 9,
        padding: compact ? '13px 6px 11px' : '18px 10px 15px',
        borderRadius: compact ? 12 : 14,
        background: selected ? inkRgba(ink, 0.1) : 'rgba(255, 255, 255, 0.02)',
        // Constant border width + a symmetric (transparent→tinted) shadow so the
        // selection glow fades cleanly in/out rather than snapping from `none`
        // (whose 0→22px blur growth "pops") or jumping border width. The result
        // is a buttery light-up as selection moves between tiles.
        border: `1.5px solid ${selected ? inkRgba(ink, 0.7) : '#24243a'}`,
        boxShadow: `0 0 ${compact ? 18 : 22}px ${inkRgba(ink, selected ? 0.22 : 0)}, inset 0 0 ${compact ? 14 : 18}px ${inkRgba(ink, selected ? 0.06 : 0)}`,
        transition: `all 0.25s ${EASING.snappy}`,
      }}
    >
      <ProgressRing ink={ink} count={count} size={compact ? 64 : 82} />
      <div style={{fontWeight: 600, fontSize: compact ? 12 : 13, letterSpacing: 0.3, color: selected ? INK_COLORS[ink].text : '#cfd3df'}}>
        {ink}
      </div>
      <div style={{fontWeight: 500, fontSize: 11, letterSpacing: 0.5, color: done ? '#f5d877' : '#7a7a92'}}>
        {done ? 'Complete' : `${count} / ${PER_INK}`}
      </div>
    </button>
  );
}
