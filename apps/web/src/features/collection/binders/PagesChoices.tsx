import type {CSSProperties} from 'react';
import {
  COLORS,
  FONT_SIZES,
  FONT_WEIGHT,
  LINE_HEIGHT,
  RADIUS,
  SPACING,
  TABULAR,
  VISUALLY_HIDDEN,
  whiteRgba,
} from '../../../shared/constants';
import type {PageSide} from '../../cards/components/binderGeometry';
import {CHOICE_LOOK, faceStyle} from './choiceLook';
import {ChosenMark} from './CoverChoices';
import './coverPicker.css';

export interface PagesChoicesProps {
  /** The size picked now. */
  chosen: PageSide;
  onPick: (side: PageSide) => void;
  disabled: boolean;
}

/** The sizes, smallest first (owner, 2026-11-05). */
const SIDES: readonly PageSide[] = [2, 3, 4];

/** Three across, under Sets in the window, in Save as a binder's box and in My collection's Pages. */
const GRID: CSSProperties = {
  ...CHOICE_LOOK,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
  gap: SPACING.sm,
  margin: 0,
  padding: SPACING.xxs,
  listStyle: 'none',
};

/** A page in small: dark, its pockets as light cells, as many across as down. */
const pageStyle = (side: PageSide): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))`,
  gap: SPACING.xxs,
  width: 40,
  aspectRatio: '0.8',
  padding: SPACING.xs,
  borderRadius: `${RADIUS.sm}px`,
  background: COLORS.background,
  boxShadow: `inset 0 0 0 1px ${whiteRgba(0.1)}`,
});

const CELL: CSSProperties = {borderRadius: `${RADIUS.xs}px`, background: whiteRgba(0.28)};

const sizeStyle = (chosen: boolean): CSSProperties => ({
  ...TABULAR,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: LINE_HEIGHT.tight,
  color: chosen ? COLORS.primary : COLORS.text,
});

const COUNT: CSSProperties = {...TABULAR, fontSize: `${FONT_SIZES.sm}px`, lineHeight: LINE_HEIGHT.tight, color: COLORS.textMuted};

/** A page of `side` by `side` pockets, drawn small. */
function PageIcon({side}: {side: PageSide}) {
  return (
    <span style={pageStyle(side)}>
      {Array.from({length: side * side}, (_, i) => (
        <span key={i} style={CELL} />
      ))}
    </span>
  );
}

/**
 * How many cards a binder's page holds, three tiles: 2 × 2 "4 a page", 3 × 3 "9 a page" and 4 × 4
 * "16 a page", each a small page of its pockets, the chosen one ringed in gold, marked and pressed
 * (`aria-pressed`), as the cover choices are.
 */
export function PagesChoices({chosen, onPick, disabled}: PagesChoicesProps) {
  return (
    <ul aria-label="Pages" style={GRID}>
      {SIDES.map((side) => {
        const on = side === chosen;
        return (
          <li key={side}>
            <button type="button" className="cover-choice" aria-pressed={on} disabled={disabled} onClick={() => onPick(side)}>
              {/* Its name whole, for screen readers: the two lines read alone would run together. */}
              <span style={VISUALLY_HIDDEN}>{`${side} × ${side}, ${side * side} a page`}</span>
              <span aria-hidden="true" style={faceStyle(on)}>
                <PageIcon side={side} />
                <span style={sizeStyle(on)}>{`${side} × ${side}`}</span>
                <span style={COUNT}>{`${side * side} a page`}</span>
              </span>
              {on && <ChosenMark />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
