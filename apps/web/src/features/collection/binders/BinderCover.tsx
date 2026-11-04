import type {CSSProperties, ReactNode, Ref} from 'react';
import {Link} from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {smallImageUrl} from '../../cards/loader';
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

/** What a cover says: the binder's name, and the line its rules read as (`ruleLine`). */
export interface CoverWords {
  name: string;
  rule: string;
}

export interface BinderCoverProps extends CoverWords {
  /** The card in its pocket, or none: an empty sleeve. */
  cover: LorcanaCard | null;
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
 * A cover's colours and timings, for `binder.css` and `binderShelf.css`, which hold only `var()`s:
 * on each tile, so a cover draws alike wherever it stands.
 */
const COVER_LOOK = {
  ...TILE,
  ...BINDER_LOOK,
  '--shelf-spine': `linear-gradient(90deg, ${blackRgba(0.6)}, ${blackRgba(0.2)} 55%, ${blackRgba(0.45)})`,
  '--shelf-spine-edge': `inset -1px 0 0 ${blackRgba(0.7)}`,
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

/** The board, a closed binder's shape. Its look and zip are `binder.css`'s and `binderShelf.css`'s. */
const BOARD: CSSProperties = {display: 'block', position: 'relative', aspectRatio: '4 / 5'};

/** The board's corners, as `binder.css` rounds them, for the shimmer in its place. */
const BOARD_RADIUS = 20;

/** The pocket the cover card sits in, centred right of the spine, a card's shape. */
const POCKET: CSSProperties = {
  position: 'absolute',
  top: '9%',
  left: '26.5%',
  width: '54%',
  aspectRatio: '63 / 88',
};

/** Positioned, so it paints over the pocket's sleeve (`::before`) and under its front sheet (`::after`). */
const ART: CSSProperties = {
  position: 'relative',
  display: 'block',
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  borderRadius: `${RADIUS.sm}px`,
};

/** The label plate: sunk into the board, the name over the rule line. */
const PLATE: CSSProperties = {
  position: 'absolute',
  left: '16%',
  right: '9%',
  bottom: '8%',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.xxs,
  padding: `${SPACING.sm}px ${SPACING.sm}px ${SPACING.xs}px`,
  borderRadius: `${RADIUS.md}px`,
  background: `linear-gradient(180deg, ${blackRgba(0.45)}, ${blackRgba(0.2)})`,
  boxShadow: `inset 0 1px 2px ${blackRgba(0.9)}, 0 1px 0 ${whiteRgba(0.07)}`,
  textAlign: 'center',
  minWidth: 0,
};

const NAME: CSSProperties = {
  ...TRUNCATE,
  maxWidth: '100%',
  fontFamily: FONTS.hero,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: FONT_WEIGHT.regular,
  lineHeight: LINE_HEIGHT.tight,
  color: COLORS.text,
};

const RULE: CSSProperties = {
  ...TRUNCATE,
  maxWidth: '100%',
  fontSize: `${FONT_SIZES.sm}px`,
  fontWeight: FONT_WEIGHT.semibold,
  lineHeight: LINE_HEIGHT.snug,
  color: COLORS.textMuted,
};

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

/** The binder face on: its board, the cover card in its pocket, and its plate. Decoration: the link's words name it. */
function Board({name, rule, cover}: CoverWords & {cover: LorcanaCard | null}) {
  const art = cover === null ? undefined : smallImageUrl(cover);
  return (
    <span aria-hidden="true" className="binder-board binder-shelf-board" style={BOARD}>
      <span className="binder-shelf-spine" />
      <span className="binder-zip-pull" />
      <span className="binder-pocket" style={POCKET}>
        {art !== undefined && <img src={art} alt="" decoding="async" loading="lazy" style={ART} />}
      </span>
      <span style={PLATE}>
        <span style={NAME}>{name}</span>
        <span style={RULE}>{rule}</span>
      </span>
      <span className="binder-shelf-ring" />
    </span>
  );
}

/**
 * One binder on the shelf (#1074): a closed zip binder holding its cover card, its name on a plate
 * with its rules under it, and under the board its Complete percentage, its count and the set
 * panel's gold bar. The whole cover is a link to the binder.
 *
 * NAMED BY ONE SCREEN-READER-ONLY LINE ("Amber, Amber ink, 46%, 293 of 625 cards"), its drawn words
 * hidden, as the Binders tab's rows are: a binder's name is the player's own words, so it never
 * goes in an attribute, and the shelf carries `ph-no-capture`.
 */
export function BinderCover({name, rule, cover, figures, promos, to, onOpen, compact, actions, note, linkRef}: BinderCoverProps) {
  const words = figureWords(figures, promos, compact);
  const percent = percentOf(figures.complete, figures.cards);
  return (
    <div className="binder-shelf-tile" style={COVER_LOOK}>
      <Link ref={linkRef} to={to} onClick={onOpen} className="binder-shelf-cover" style={LINK}>
        <Board name={name} rule={rule} cover={cover} />
        <span aria-hidden="true" style={FIGURES}>
          <span style={FIGURE_LINE}>
            <span style={PERCENT}>{words.percent}</span>
            <span>{words.shown}</span>
          </span>
          <span style={TRACK}>
            <span style={fillStyle(percent, isFinished(figures.complete, figures.cards))} />
          </span>
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
