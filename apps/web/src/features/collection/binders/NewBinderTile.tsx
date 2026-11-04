import type {CSSProperties} from 'react';
import {
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  FONT_WEIGHT,
  GOLD_GLOW,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  hexRgba,
  whiteRgba,
} from '../../../shared/constants';
import {BOARD_RADIUS} from './BinderCover';
import './binderShelf.css';
import {SHELF_FULL_LINE} from './shelfWords';

/** The tile's colours and timing, for `binderShelf.css`, which holds only `var()`s. */
const LOOK = {
  '--shelf-new-edge': whiteRgba(0.22),
  '--shelf-new-edge-hover': GOLD_GLOW.activeBorder,
  '--shelf-focus-ring': GOLD_GLOW.focusRing,
  '--shelf-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

/** A cover's board, its shape and corners, drawn as a dashed outline round the words. */
const BOARD: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.sm,
  aspectRatio: '4 / 5',
  padding: SPACING.lg,
  borderRadius: BOARD_RADIUS,
  borderWidth: 2,
  borderStyle: 'dashed',
  textAlign: 'center',
};

const PLUS: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 44,
  height: 44,
  borderRadius: `${RADIUS.pill}px`,
  background: hexRgba(COLORS.primary, 0.12),
  color: COLORS.primary,
};

const TITLE: CSSProperties = {
  fontFamily: FONTS.hero,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: FONT_WEIGHT.regular,
  lineHeight: LINE_HEIGHT.tight,
  color: COLORS.text,
};

const HINT: CSSProperties = {fontSize: `${FONT_SIZES.sm}px`, lineHeight: LINE_HEIGHT.snug, color: COLORS.textMuted};

function PlusIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * New binder, after the shelf's last cover (#1075): a cover's board in a dashed outline, a +,
 * and what a binder keeps. It opens the New binder window.
 */
export function NewBinderTile({onNew, compact}: {onNew: () => void; compact: boolean}) {
  return (
    <div style={LOOK}>
      <button type="button" className="binder-shelf-new" onClick={onNew}>
        <span className="binder-shelf-new-board" style={BOARD}>
          <span style={PLUS}>
            <PlusIcon />
          </span>
          <span style={TITLE}>New binder</span>
          {!compact && <span style={HINT}>Pick its inks, sets, rarities…</span>}
        </span>
      </button>
    </div>
  );
}

const FULL_LINE: CSSProperties = {
  margin: 0,
  maxWidth: '24ch',
  fontSize: `${FONT_SIZES.base}px`,
  lineHeight: LINE_HEIGHT.relaxed,
  color: COLORS.textMuted,
};

/** In New binder's place once the shelf holds 30: why there is no other. */
export function ShelfFullLine() {
  return <p style={FULL_LINE}>{SHELF_FULL_LINE}</p>;
}
