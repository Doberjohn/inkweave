import {useRef, type CSSProperties, type MouseEvent} from 'react';
import {useContainerWidth} from 'inkweave-ui/hooks/useContainerWidth';
import {useZoomBeforePaint} from 'inkweave-ui/hooks/useZoomBeforePaint';
import {
  COLORS,
  FOIL_SHEEN,
  FONT_SIZES,
  FONTS,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  SPACING,
  TABULAR,
  VISUALLY_HIDDEN,
  whiteRgba,
} from '../../shared/constants';
import {useHover} from '../../shared/hooks';
import {PeopleSolidIcon} from '../friends/icons';

interface FriendsBadgeProps {
  /** How many friends have the card for the reader. */
  count: number;
  /** Its name, "11 friends have it", which the pocket's card is described by too. */
  label: string;
  /** Every copy on offer is a foil: brushed gold, as the copies stripe marks a foil. */
  gold: boolean;
  onPress: () => void;
}

/** The pocket width the badge is drawn for (the design's): a smaller pocket zooms it down, never up. */
const DRAWN_POCKET = 130;
const zoomFor = (width: number) => Math.min(1, width / DRAWN_POCKET);

/**
 * A click leaves the focus where it was, as the copies stripe's − and + do (#790): a mouse click
 * focuses even a button out of the Tab order, and the next Tab would start from inside the spread.
 */
const keepFocus = (e: MouseEvent) => e.preventDefault();

/**
 * A binder pocket's friends badge: at the pocket's top right, the people glyph and how
 * many sharing friends hold the card in a finish the reader lacks. Pressing it opens Friends who
 * have it, and never the card window under it.
 *
 * It lies over the pocket in the layer `CollectionBinder` gives it, which describes the pocket's
 * card by it. Out of the Tab order, since the spread is one Tab stop (#790): from the keyboard the
 * card window's count is the way in. Drawn 26px tall for a 130px pocket and zoomed with a smaller
 * one before it first paints, as the copies stripe is (`useZoomBeforePaint`). On a touch screen a
 * transparent ring takes its tap area to 32px at any zoom (binder.css).
 */
export function FriendsBadge({count, label, gold, onPress}: FriendsBadgeProps) {
  const sizer = useRef<HTMLDivElement>(null);
  const badge = useRef<HTMLButtonElement>(null);
  const width = useContainerWidth(sizer);
  useZoomBeforePaint(sizer, badge, zoomFor);
  const {hovered, hoverProps} = useHover();
  const zoom = width > 0 ? zoomFor(width) : 1;
  return (
    <>
      {/* What is measured: the pocket's width, with no height. */}
      <div ref={sizer} style={SIZER_STYLE} />
      <div style={CORNER_STYLE}>
        <button
          ref={badge}
          type="button"
          className="binder-friends-badge"
          tabIndex={-1}
          // A press opens the dialog, and never lifts the binder's page (#942).
          data-no-grab
          aria-haspopup="dialog"
          onMouseDown={keepFocus}
          onClick={onPress}
          {...hoverProps}
          style={{
            ...BADGE_STYLE,
            ...(gold ? GOLD_STYLE : DARK_STYLE),
            ...(hovered && HOVER_STYLE),
            zoom,
            // The tap ring's size undoes it (binder.css): a zoom scales the ring too.
            ['--badge-zoom' as string]: zoom,
          }}>
          <PeopleSolidIcon />
          <span aria-hidden="true">{count}</span>
          {/* Its name in words rather than aria-label, so the card it describes reads them too. */}
          <span style={VISUALLY_HIDDEN}>{label}</span>
        </button>
      </div>
    </>
  );
}

const SIZER_STYLE: CSSProperties = {position: 'absolute', left: 0, right: 0, top: 0, height: 0};

/** Its corner, held off the pocket's edges at every zoom: the zoom shrinks only the badge. */
const CORNER_STYLE: CSSProperties = {position: 'absolute', top: SPACING.xs, right: SPACING.xs, display: 'flex'};

/** The badge's height at a 130px pocket. */
const DRAWN_HEIGHT = 26;

const BADGE_STYLE: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: SPACING.xs,
  height: DRAWN_HEIGHT,
  padding: `0 ${SPACING.sm}px`,
  border: 'none',
  borderRadius: RADIUS.pill,
  color: COLORS.text,
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.xl}px`,
  fontWeight: 700,
  lineHeight: 1,
  ...TABULAR,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
  // Its layer lets presses through to the card everywhere but here.
  pointerEvents: 'auto',
};

/** A hairline ring keeps the dark badge apart from dark art. */
const DARK_STYLE: CSSProperties = {
  background: COLORS.background,
  boxShadow: `0 0 0 1px ${whiteRgba(0.14)}, ${SHADOWS.raise}`,
};

const GOLD_STYLE: CSSProperties = {
  ...FOIL_SHEEN.surface(COLORS.background, false),
  boxShadow: `0 0 0 1px ${GOLD_GLOW.activeBorder}, ${SHADOWS.raise}`,
};

/** Pointed at, a gold ring says it opens something of its own, apart from the card under it. */
const HOVER_STYLE: CSSProperties = {boxShadow: `0 0 0 2px ${COLORS.primary}, ${SHADOWS.raise}`};
