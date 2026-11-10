import type {CSSProperties} from 'react';
import {BINDER_LOOK} from '../../cards/components/binderLook';
import {
  COLORS,
  DURATION,
  EASING,
  FONT_SIZES,
  FONT_WEIGHT,
  GOLD_GLOW,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  TRUNCATE,
  VISUALLY_HIDDEN,
  blackRgba,
  whiteRgba,
} from '../../../shared/constants';
import {COVER_DESIGNS, type CoverDesign} from './coverDesigns';
import './coverPicker.css';

export interface CoverChoicesProps {
  /** The id of the design picked now. */
  chosen: string;
  onPick: (design: CoverDesign) => void;
  disabled: boolean;
  /** Each design's name under it; else for screen readers alone, where the column leaves no room. */
  named: boolean;
}

/** The choices' look, for `coverPicker.css`, which holds only `var()`s. */
const CHOICE_LOOK = {
  '--cover-radius': `${RADIUS.lg}px`,
  '--cover-edge': '0 0 0 1px transparent',
  '--cover-hover-ring': `0 0 0 1px ${GOLD_GLOW.activeBorder}`,
  '--cover-chosen-ring': `0 0 0 2px ${COLORS.primary}, ${GOLD_GLOW.shadow}`,
  '--cover-focus-ring': GOLD_GLOW.focusRing,
  '--cover-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

/** Four across, as the window's preview and Change cover both lay them. */
const GRID: CSSProperties = {
  ...CHOICE_LOOK,
  display: 'grid',
  gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
  gap: SPACING.sm,
  margin: 0,
  padding: SPACING.xxs,
  listStyle: 'none',
};

/** Inside the button, which takes no inline style of its own: room round the binder for the ring, and the chosen one's gold wash. */
const faceStyle = (chosen: boolean): CSSProperties => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.xs,
  padding: SPACING.xs,
  borderRadius: `${RADIUS.lg}px`,
  background: chosen ? GOLD_GLOW.activeBg : undefined,
});

/** A closed binder in small: the board, its spine, and the design across its face. */
const SWATCH = {
  ...BINDER_LOOK,
  position: 'relative',
  display: 'block',
  width: '100%',
  aspectRatio: '4 / 5',
  borderRadius: `${RADIUS.lg}px`,
  background: 'var(--binder-board)',
  boxShadow: `0 4px 10px -4px ${blackRgba(0.8)}, inset 0 0 0 1px ${whiteRgba(0.07)}`,
} as CSSProperties;

const SPINE: CSSProperties = {
  position: 'absolute',
  top: 0,
  bottom: 0,
  left: 0,
  width: '9%',
  borderRadius: `${RADIUS.lg}px 0 0 ${RADIUS.lg}px`,
  background: `linear-gradient(90deg, ${blackRgba(0.6)}, ${blackRgba(0.2)})`,
};

/** The face, a hairline in from the board's edges and right of the spine. */
const SWATCH_FACE: CSSProperties = {
  position: 'absolute',
  top: 3,
  right: 3,
  bottom: 3,
  left: 'calc(9% + 2px)',
  borderRadius: `${RADIUS.sm}px`,
  overflow: 'hidden',
  boxShadow: `inset 0 0 0 1px ${blackRgba(0.6)}`,
};

const nameStyle = (chosen: boolean): CSSProperties => ({
  ...TRUNCATE,
  maxWidth: '100%',
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: LINE_HEIGHT.snug,
  color: chosen ? COLORS.primary : COLORS.textMuted,
});

const CHECK: CSSProperties = {
  position: 'absolute',
  top: -SPACING.xs,
  right: -SPACING.xs,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 20,
  height: 20,
  borderRadius: `${RADIUS.pill}px`,
  background: COLORS.primary,
  color: COLORS.background,
};

/** The chosen design's mark beside its gold ring, so the pick reads without colour too. */
function ChosenMark() {
  return (
    <span aria-hidden="true" style={CHECK}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
        <path d="M5 12.5l4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

/** A small closed binder in a design, with no words: the pickers' face for it. */
function CoverSwatch({design}: {design: CoverDesign}) {
  return (
    <span aria-hidden="true" style={SWATCH}>
      <span style={SPINE} />
      <span data-cover={design.id} style={{...SWATCH_FACE, background: design.ground}} />
    </span>
  );
}

/**
 * The eight cover designs to pick from, four across, each a small closed binder in its design
 * named by its design's name, the chosen one ringed in gold, marked and pressed
 * (`aria-pressed`). Change cover names them under each; the New binder window's preview column
 * leaves them room for the binder alone.
 */
export function CoverChoices({chosen, onPick, disabled, named}: CoverChoicesProps) {
  return (
    <ul aria-label="Covers" style={GRID}>
      {COVER_DESIGNS.map((design) => {
        const on = design.id === chosen;
        return (
          <li key={design.id}>
            <button type="button" className="cover-choice" aria-pressed={on} disabled={disabled} onClick={() => onPick(design)}>
              <span style={faceStyle(on)}>
                <CoverSwatch design={design} />
                <span style={named ? nameStyle(on) : VISUALLY_HIDDEN}>{design.label}</span>
              </span>
              {on && <ChosenMark />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
