import type {Ink} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONT_SIZES, INK_COLORS, whiteRgba} from '../../shared/constants';
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
 * Symmetric (transparent→tinted) glow for the tile: a constant border width plus
 * a shadow whose alpha fades in/out so the selection lights up cleanly rather
 * than snapping from `none` (whose 0→22px blur growth "pops"). Pulled out so its
 * `selected`/`compact` branches don't pile onto the tile's complexity.
 */
function selectionShadow(ink: Ink, selected: boolean, compact: boolean): string {
  const blur = compact ? 18 : 22;
  const innerBlur = compact ? 14 : 18;
  return `0 0 ${blur}px ${inkRgba(ink, selected ? 0.22 : 0)}, inset 0 0 ${innerBlur}px ${inkRgba(ink, selected ? 0.06 : 0)}`;
}

/** The ink name over its `count / 34` (or a gold "Complete" at 34). */
function TileLabel({ink, count, selected, compact}: {ink: Ink; count: number; selected: boolean; compact: boolean}) {
  const done = count >= PER_INK[ink];
  return (
    <>
      <div style={{fontWeight: 600, fontSize: compact ? FONT_SIZES.md : FONT_SIZES.base, letterSpacing: 0.3, color: selected ? INK_COLORS[ink].text : COLORS.text}}>
        {ink}
      </div>
      <div style={{fontWeight: 500, fontSize: FONT_SIZES.lg, letterSpacing: 0.5, color: done ? COLORS.primaryHover : COLORS.text}}>
        {done ? 'Complete' : `${count} / ${PER_INK[ink]}`}
      </div>
    </>
  );
}

/**
 * A selectable tracker tile: the ink's progress ring over its name and
 * `count / 34` (or a gold "Complete" at 34). Selecting it features that ink's
 * board below; the selected tile gets an ink-tinted border + glow.
 */
export function InkTrackerTile({ink, count, selected, onSelect, compact = false}: InkTrackerTileProps) {
  return (
    <button
      type="button"
      data-testid="ink-tracker-tile"
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
        background: selected ? inkRgba(ink, 0.1) : whiteRgba(0.02),
        border: `1.5px solid ${selected ? inkRgba(ink, 0.7) : COLORS.surfaceHover}`,
        boxShadow: selectionShadow(ink, selected, compact),
        transition: `all 0.25s ${EASING.bounce}`,
      }}
    >
      <ProgressRing ink={ink} count={count} size={compact ? 64 : 82} />
      <TileLabel ink={ink} count={count} selected={selected} compact={compact} />
    </button>
  );
}
