import type {CSSProperties, ReactNode, Ref} from 'react';
import {Link} from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import {BINDER_LOOK} from '../../cards/components/binderLook';
import '../../cards/components/binder.css';
import './binderShelf.css';
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
  SHADOWS,
  SPACING,
  TABULAR,
  TRUNCATE,
  VISUALLY_HIDDEN,
  blackRgba,
  hexRgba,
  whiteRgba,
} from '../../../shared/constants';
import {isFinished, percentOf} from '../collectionStats';
import type {BinderFigures} from './binderCovers';
import type {CoverDesign} from './coverDesigns';

/** What a cover says: the binder's name, and the line its rules read as (`ruleLine`). */
export interface CoverWords {
  name: string;
  rule: string;
}

export interface BinderCoverProps extends CoverWords {
  /** Its cover's design, drawn across the board's face. */
  cover: CoverDesign;
  figures: BinderFigures;
  /** Its Sets are promos alone, so it counts promos. */
  promos: boolean;
  /** The binder's address, which the cover opens as a push, so Back returns to the shelf. */
  to: string;
  /** Told when the cover is followed, before the page leaves the shelf. */
  onOpen: () => void;
  /** A phone's two across: the count's short form. */
  compact: boolean;
  /** A binder of your own's ⋯ and its menu (`BinderMenu`), at the cover's top right. */
  actions?: ReactNode;
  /** A line under the numbers: a change that failed and says so. */
  note?: string | null;
  linkRef?: Ref<HTMLAnchorElement>;
}

const count = (n: number) => n.toLocaleString('en-US');

/** What the figures under a cover say, drawn and spoken. */
interface FigureWords {
  percent: string;
  shown: string;
  spoken: string;
}

/** "46%" and "293 of 625 cards" ("293 / 625" on a phone), or a dash for a binder whose rules hold no card. */
function figureWords({complete, cards}: BinderFigures, promos: boolean, compact: boolean): FigureWords {
  if (cards === 0) return {percent: '–', shown: 'No cards', spoken: 'no cards'};
  const spoken = `${count(complete)} of ${count(cards)} ${promos ? 'promos' : 'cards'}`;
  return {
    percent: `${percentOf(complete, cards)}%`,
    shown: compact ? `${count(complete)} / ${count(cards)}` : spoken,
    spoken,
  };
}

/** The cover's name as its words read: "Amber, Amber ink, 46%, 293 of 625 cards". */
const spokenName = ({name, rule}: CoverWords, words: FigureWords) =>
  [name, rule, words.percent === '–' ? undefined : words.percent, words.spoken].filter(Boolean).join(', ');

const TILE: CSSProperties = {position: 'relative', minWidth: 0};

/**
 * A tile's colours and timings for its hover and focus, for `binderShelf.css`, which holds only
 * `var()`s. The board carries its own (`BOARD`).
 */
const COVER_LOOK = {
  ...TILE,
  '--shelf-hover-ring': `0 0 0 1px ${GOLD_GLOW.activeBorder}, ${SHADOWS.glowSm}`,
  '--shelf-focus-ring': GOLD_GLOW.focusRing,
  '--shelf-fade': `${DURATION.fast}ms ${EASING.snappy}`,
} as CSSProperties;

const LINK: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.md,
  color: 'inherit',
  textDecoration: 'none',
  // The board's gold ring is the focus indicator (`binderShelf.css`).
  outline: 'none',
};

/**
 * The board, with the colours `binder.css` and `binderShelf.css` draw it in: on the board itself,
 * so it draws alike on the shelf and in the New binder window's preview.
 */
const BOARD = {
  ...BINDER_LOOK,
  '--shelf-spine': `linear-gradient(90deg, ${blackRgba(0.6)}, ${blackRgba(0.2)} 55%, ${blackRgba(0.45)})`,
  '--shelf-spine-edge': `inset -1px 0 0 ${blackRgba(0.7)}`,
  display: 'block',
  position: 'relative',
  aspectRatio: '4 / 5',
} as CSSProperties;

/** The board's corners, as `binder.css` rounds them, for the shimmer in its place and New binder's outline. */
export const BOARD_RADIUS = 20;

/**
 * How far the face sits in from the board's top, right and bottom: the zip's tape runs from 2 to
 * 8px in (`binder.css`), and the face starts clear of it.
 */
const FACE_INSET = 10;

/** The face, the design across it: inside the zip on three sides, from the spine (7%) on the fourth. */
const FACE: CSSProperties = {
  position: 'absolute',
  top: FACE_INSET,
  right: FACE_INSET,
  bottom: FACE_INSET,
  left: 'calc(7% + 3px)',
  borderRadius: `${RADIUS.card}px`,
  overflow: 'hidden',
  boxShadow: `inset 0 0 0 1px ${blackRgba(0.6)}, inset 0 1px 0 ${whiteRgba(0.12)}`,
};

/** The label near the face's foot: a dark plate over the pattern, edged in the design's foil, the name over the rule line. */
const labelStyle = (foil: string): CSSProperties => ({
  position: 'absolute',
  left: '9%',
  right: '9%',
  bottom: '8%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.xxs,
  padding: `${SPACING.sm}px ${SPACING.sm}px ${SPACING.xs}px`,
  borderRadius: `${RADIUS.lg}px`,
  background: COLORS.scrim,
  boxShadow: `0 0 0 1px ${hexRgba(foil, 0.33)}, 0 4px 10px ${blackRgba(0.55)}`,
  textAlign: 'center',
  minWidth: 0,
});

const nameStyle = (foil: string): CSSProperties => ({
  ...TRUNCATE,
  maxWidth: '100%',
  fontFamily: FONTS.hero,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: FONT_WEIGHT.regular,
  lineHeight: LINE_HEIGHT.tight,
  color: foil,
  textShadow: `0 1px 0 ${blackRgba(0.6)}, 0 -1px 0 ${whiteRgba(0.1)}`,
});

const ruleStyle = (foil: string): CSSProperties => ({
  ...TRUNCATE,
  maxWidth: '100%',
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: LINE_HEIGHT.snug,
  color: foil,
  opacity: 0.78,
  textShadow: `0 1px 0 ${blackRgba(0.55)}`,
});

const FIGURES: CSSProperties = {display: 'flex', flexDirection: 'column', gap: SPACING.sm, padding: `0 ${SPACING.xxs}px`};

const FIGURE_LINE: CSSProperties = {
  ...TABULAR,
  display: 'flex',
  alignItems: 'baseline',
  gap: SPACING.sm,
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: FONT_WEIGHT.medium,
  color: COLORS.textMuted,
};

const PERCENT: CSSProperties = {fontSize: `${FONT_SIZES.xl}px`, fontWeight: FONT_WEIGHT.bold, color: COLORS.text};

const TRACK: CSSProperties = {
  display: 'block',
  height: 4,
  borderRadius: `${RADIUS.pill}px`,
  background: whiteRgba(0.07),
  overflow: 'hidden',
  // The container the fill's gradient is sized to, as the set panel's bars are.
  containerType: 'inline-size',
};

/**
 * The set panel's bar, still: one gold gradient across the whole track, of which the bar shows
 * as much as it reaches, and plain gold once full.
 */
const fillStyle = (percent: number, full: boolean): CSSProperties => ({
  display: 'block',
  height: '100%',
  width: `${percent}%`,
  borderRadius: `${RADIUS.pill}px`,
  backgroundImage: `linear-gradient(90deg, ${GOLD_GLOW.hoverBorder}, ${COLORS.primary})`,
  backgroundSize: '100cqw 100%',
  backgroundRepeat: 'no-repeat',
  backgroundColor: hexRgba(COLORS.primary, full ? 1 : 0),
});

const ACTIONS: CSSProperties = {position: 'absolute', top: SPACING.sm, right: SPACING.sm};

const NOTE: CSSProperties = {margin: `${SPACING.sm}px 0 0`, fontSize: `${FONT_SIZES.base}px`, color: COLORS.textMuted};

/** The set panel's gold bar, as full as the binder is complete. Decoration: the words beside it say it. */
export function CoverBar({figures: {complete, cards}}: {figures: BinderFigures}) {
  return (
    <span aria-hidden="true" style={TRACK}>
      <span style={fillStyle(percentOf(complete, cards), isFinished(complete, cards))} />
    </span>
  );
}

/**
 * The binder face on: its board, its design across the face inside the zip, and the label with
 * its name and rule in the design's foil. Decoration: the link's words name it, or the New binder
 * window's preview, which says the same beside it.
 */
export function CoverBoard({name, rule, cover}: CoverWords & {cover: CoverDesign}) {
  return (
    <span aria-hidden="true" className="binder-board binder-shelf-board" style={BOARD}>
      <span className="binder-shelf-spine" />
      <span data-cover={cover.id} style={{...FACE, background: cover.ground}}>
        <span style={labelStyle(cover.foil)}>
          <span style={nameStyle(cover.foil)}>{name}</span>
          <span style={ruleStyle(cover.foil)}>{rule}</span>
        </span>
      </span>
      <span className="binder-zip-pull" />
      <span className="binder-shelf-ring" />
    </span>
  );
}

/**
 * One binder on the shelf (#1074): a closed zip binder in its cover's design, its name on a label
 * with its rules under it, and under the board its Complete percentage, its count and the set
 * panel's gold bar. The whole cover is a link to the binder.
 *
 * NAMED BY ONE SCREEN-READER-ONLY LINE ("Amber, Amber ink, 46%, 293 of 625 cards"), its drawn words
 * hidden, as the Binders tab's rows are: a binder's name is the player's own words, so it never
 * goes in an attribute, and the shelf carries `ph-no-capture`.
 */
export function BinderCover({name, rule, cover, figures, promos, to, onOpen, compact, actions, note, linkRef}: BinderCoverProps) {
  const words = figureWords(figures, promos, compact);
  return (
    <div className="binder-shelf-tile" style={COVER_LOOK}>
      <Link ref={linkRef} to={to} onClick={onOpen} className="binder-shelf-cover" style={LINK}>
        <CoverBoard name={name} rule={rule} cover={cover} />
        <span aria-hidden="true" style={FIGURES}>
          <span style={FIGURE_LINE}>
            <span style={PERCENT}>{words.percent}</span>
            <span>{words.shown}</span>
          </span>
          <CoverBar figures={figures} />
        </span>
        <span style={VISUALLY_HIDDEN}>{spokenName({name, rule}, words)}</span>
      </Link>
      {actions && <div style={ACTIONS}>{actions}</div>}
      {note && (
        <p role="alert" style={NOTE}>
          {note}
        </p>
      )}
    </div>
  );
}

/** A figure line's words while nothing is counted: they hold its height, unseen under the shimmer. */
const HELD_LINE: CSSProperties = {...FIGURE_LINE, position: 'relative', visibility: 'hidden'};

const LINE_SHIMMER: CSSProperties = {position: 'absolute', inset: 0, width: '70%', visibility: 'visible'};

/**
 * A cover still to come, exactly a cover's size: the board's shape, the figure line and the bar,
 * in the app's shimmer, so nothing moves as the real one lands (#1074).
 */
export function CoverSkeleton() {
  return (
    <div aria-hidden="true" style={TILE}>
      <span style={{...LINK, pointerEvents: 'none'}}>
        <Skeleton inline borderRadius={BOARD_RADIUS} style={BOARD} />
        <span style={FIGURES}>
          <span style={HELD_LINE}>
            <span style={PERCENT}>0%</span>
            <span>0 cards</span>
            <Skeleton inline height="100%" borderRadius={RADIUS.sm} style={LINE_SHIMMER} />
          </span>
          <span style={TRACK} />
        </span>
      </span>
    </div>
  );
}
