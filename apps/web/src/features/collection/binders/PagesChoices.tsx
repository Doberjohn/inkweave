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

/**
 * Three in a row, each at its own size, under Sets in the window, in Save as a binder's box and in
 * My collection's Pages: short enough that the window's rules still fit a 1920x1080 screen, in
 * Firefox too, whose fields stand a little taller. Room at the sides alone for the chosen one's
 * ring, which the window's scrolling column would clip there; above and below it shows in the
 * space round the row.
 */
const GRID: CSSProperties = {
  ...CHOICE_LOOK,
  display: 'grid',
  gridTemplateColumns: 'repeat(3, max-content)',
  gap: SPACING.sm,
  margin: 0,
  padding: `0 ${SPACING.xxs}px`,
  listStyle: 'none',
};

/** A page in small: dark, its pockets as light cells, as many across as down. */
const pageStyle = (side: PageSide): CSSProperties => ({
  display: 'grid',
  gridTemplateColumns: `repeat(${side}, minmax(0, 1fr))`,
  gap: SPACING.xxs,
  width: 28,
  aspectRatio: '0.8',
  padding: SPACING.xxs,
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

/** The page beside its words, which sit one over the other. */
const faceRow = (chosen: boolean): CSSProperties => ({
  ...faceStyle(chosen),
  flexDirection: 'row',
  gap: SPACING.sm,
  padding: `${SPACING.xs}px ${SPACING.md}px ${SPACING.xs}px ${SPACING.xs}px`,
});

const WORDS: CSSProperties = {display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: SPACING.xxs};

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
              <span aria-hidden="true" style={faceRow(on)}>
                <PageIcon side={side} />
                <span style={WORDS}>
                  <span style={sizeStyle(on)}>{`${side} × ${side}`}</span>
                  <span style={COUNT}>{`${side * side} a page`}</span>
                </span>
              </span>
              {on && <ChosenMark />}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
