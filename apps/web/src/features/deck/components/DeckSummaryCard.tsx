import {useState} from 'react';
import {Link} from 'react-router-dom';
import {InkIcon} from '../../../shared/components/InkIcon';
import {
  blackRgba,
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  RADIUS,
  SHADOWS,
  TRUNCATE,
} from '../../../shared/constants';
import {ART_OFFSET, ART_SCALE, FRAME, frameFor} from './deckFrame';
import {deckTint} from './deckTint';
import type {Deck} from '../types';

interface DeckSummaryCardProps {
  deck: Deck;
  /**
   * Destination override. Defaults to the deck's own URL, which is correct for
   * anything that exists in the cloud. The signed-out local draft has no row to
   * fetch, so the list points it at the builder that already holds it instead.
   */
  to?: string;
  /**
   * The publisher's display name, on lists where authorship is the point.
   *
   * The DISPLAY name, not the handle: the handle is a unique slug nothing renders,
   * and a card shows a name. Omitted on your own list, where every deck is yours.
   */
  authorName?: string;
  /**
   * Art for the frame's window — the deck's signature card, chosen by
   * {@link signatureCard}. Resolved by the caller because that needs the card
   * database, and a tile should not reach for it.
   */
  artUrl?: string;
}

/** A deck can be saved before it is named; the card still needs something to read. */
const FALLBACK_NAME = 'Untitled deck';

const pct = (n: number) => `${n}%`;

/**
 * The frame bitmap, or the placeholder for a deck that has no ink identity yet.
 *
 * A draft with no cards has no inks, so `frameFor` returns null. It gets a plain
 * panel at the SAME aspect and with the same plate drawn in CSS, rather than the old
 * short tile: a grid mixing a 377px portrait card with a 148px landscape one reads as
 * broken, and the empty state is not the place to spend that.
 */
function FrameBackdrop({deck}: {deck: Deck}) {
  const src = frameFor(deck.inks);
  if (src) {
    return (
      <img
        src={src}
        alt=""
        style={{position: 'absolute', inset: 0, width: '100%', height: '100%', display: 'block'}}
      />
    );
  }
  return (
    <span aria-hidden style={{position: 'absolute', inset: 0, background: deckTint(deck.inks)}}>
      <span
        style={{
          position: 'absolute',
          left: pct(FRAME.art.left),
          width: pct(FRAME.art.width),
          top: pct(FRAME.bandTop),
          height: pct(FRAME.bandHeight),
          background: COLORS.surfaceAlt,
        }}
      />
    </span>
  );
}

/**
 * The card art, in the frame's blanked window.
 *
 * The window is OPAQUE white in the bitmap, not transparent, so the art cannot sit
 * behind the frame — it has to be placed on top, exactly filling the hole.
 *
 * Sized as a percentage rather than left at natural size (which is what the mockup
 * did): card images are a uniform 337x470, so natural sizing framed correctly at
 * exactly one tile width, tightening the crop below it and leaving a gap above ~390px.
 */
function FrameArt({artUrl, deckName}: {artUrl?: string; deckName: string}) {
  return (
    <span
      style={{
        position: 'absolute',
        overflow: 'hidden',
        left: pct(FRAME.art.left),
        top: pct(FRAME.art.top),
        width: pct(FRAME.art.width),
        height: pct(FRAME.art.height),
        // Fills the window while the art loads, and stands in permanently for a deck
        // with no characters in it yet.
        background: COLORS.surfaceAlt,
      }}>
      {artUrl && (
        <img
          src={artUrl}
          // Decorative: the deck name is right below it and names the same thing.
          alt=""
          loading="lazy"
          style={{
            position: 'absolute',
            top: 0,
            width: pct(ART_SCALE),
            height: 'auto',
            display: 'block',
            transform: `translate(${ART_OFFSET.x}%, ${ART_OFFSET.y}%)`,
          }}
          data-deck={deckName}
        />
      )}
    </span>
  );
}

/**
 * The deck name, on the frame's coloured plate.
 *
 * ONE line, always. The plate is a fixed 9.28% of the card and the bitmap owns that
 * geometry, so a wrapped name would spill onto the strip below it. The longest real
 * deck name in the wild is 71 characters; truncation is the only honest option.
 */
function NamePlate({name}: {name: string}) {
  return (
    <span
      style={{
        position: 'absolute',
        isolation: 'isolate',
        left: pct(FRAME.art.left),
        width: pct(FRAME.art.width),
        top: pct(FRAME.bandTop),
        height: pct(FRAME.bandHeight),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: `0 ${pct(6)}`,
        fontFamily: FONTS.body,
        fontWeight: 700,
        fontSize: `clamp(${FONT_SIZES.sm}px, 5.6cqw, ${FONT_SIZES.xxxl}px)`,
        // Pure white, not the house off-white. The contrast below is tuned for it:
        // COLORS.white would drop the worst frame from 5.14 to 4.10 and fail AA.
        color: COLORS.heroTitle,
        textShadow: `0 1px 2px ${blackRgba(0.85)}`,
        ...TRUNCATE,
      }}>
      {/*
        The plate, darkened. MEASURED: white text on the raw band fails the WCAG
        body-text bar (4.5) on 16 of the 21 frames, worst 2.01 — every failure is an
        Amber frame, and every other ink clears it. At 35% the worst lands exactly on
        4.5; 40% puts it at 5.14.

        The bar is 4.5 rather than the 3.0 large-text one because the name renders
        10-17px at real tile widths, and WCAG's large-text floor is 18.66px at bold.

        A scrim on the PLATE, not opacity on the whole frame: opacity would dim the
        parchment and art that have no problem, and it composites against whatever is
        behind the card, so the correction would silently invert on a light surface.
      */}
      <span aria-hidden style={{position: 'absolute', inset: 0, background: blackRgba(0.4), zIndex: -1}} />
      <span style={TRUNCATE}>{name}</span>
    </span>
  );
}

/**
 * The classification strip: ink symbols, then the deck's author.
 *
 * On a printed card this line is "Storyborn - Villain - Hero". Here it carries who
 * made the deck, which is the nearest true equivalent and, unlike playstyle tags,
 * exists for every deck.
 */
function ClassificationStrip({deck, authorName}: {deck: Deck; authorName?: string}) {
  return (
    <span
      style={{
        position: 'absolute',
        left: pct(FRAME.art.left),
        width: pct(FRAME.art.width),
        top: pct(FRAME.stripTop),
        height: pct(FRAME.stripHeight),
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONTS.body,
        fontWeight: 700,
        fontSize: `clamp(${FONT_SIZES.xs}px, 3.8cqw, ${FONT_SIZES.lg}px)`,
        color: COLORS.heroTitle,
        textShadow: `0 1px 2px ${blackRgba(0.9)}`,
        // NOT hidden: the symbols are deliberately taller than this band so they sit
        // proud of it, as an ink symbol does on a printed card. Clipping here sliced
        // their tops and bottoms off; the text does its own clipping instead.
        overflow: 'visible',
      }}>
      {/*
        Pinned left and taken OUT of the flex flow, so the author centres against the
        CARD rather than against the space the symbols leave. `height: 100%` and not a
        translate: the symbols size themselves as a percentage of this box, and a
        percentage height needs a definite ancestor — with auto height they fell back
        to the SVG's natural size and buried the text.
      */}
      <span
        style={{
          position: 'absolute',
          left: pct(1.5),
          top: 0,
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          filter: `drop-shadow(0 1px 2px ${blackRgba(0.85)})`,
        }}>
        {deck.inks.map((ink, i) => (
          <InkIcon
            key={ink}
            ink={ink}
            decorative={false}
            showTooltip
            // Every ink SVG carries 10% transparent padding a side, so touching
            // hexagons need the second pulled back by 20% of its own width.
            style={{height: '7.5cqw', width: 'auto', marginLeft: i === 0 ? 0 : '-1.5cqw'}}
          />
        ))}
      </span>
      {authorName && (
        <span
          style={{
            ...TRUNCATE,
            maxWidth: pct(70),
            // Optically centred. Flex centres the LINE BOX, and at line-height normal
            // that box is ~1.23x the font size with the leading split unevenly, which
            // left the ink up to 2.6px low. The nudge is in em so it holds at every
            // tile width; ~1px is the floor, because a descender is real ink and moves
            // the ink centre down (measured: "Doberjohn" and "Anna" sit 1px apart at
            // any setting).
            lineHeight: 1,
            position: 'relative',
            top: '-0.04em',
          }}>
          {authorName}
        </span>
      )}
    </span>
  );
}

/**
 * One deck in either `/decks` list, as a Lorcana-style card.
 *
 * It is an anchor, not a button, because these are real URLs and a list of decks is
 * exactly where middle-click and open-in-new-tab earn their keep.
 *
 * `container-type: inline-size` is what makes the overlays work: every position and
 * type size here is a percentage or a `cqw` of the card, so one set of measured
 * constants serves the card at any width in the grid.
 *
 * NOTE: the card count the old tile showed has no home on the frame. The strip
 * carries the author by owner ruling, and the parchment box below it is undesigned.
 * Dropped deliberately rather than squeezed in; the parchment is where it would go.
 */
export function DeckSummaryCard({deck, to, authorName, artUrl}: DeckSummaryCardProps) {
  const [hovered, setHovered] = useState(false);
  const name = deck.name.trim() || FALLBACK_NAME;

  return (
    <Link
      to={to ?? `/decks/${deck.id}`}
      aria-label={authorName ? `${name}, by ${authorName}` : name}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        containerType: 'inline-size',
        position: 'relative',
        display: 'block',
        width: '100%',
        aspectRatio: `${FRAME.aspect}`,
        borderRadius: `${RADIUS.xl}px`,
        overflow: 'hidden',
        textDecoration: 'none',
        boxShadow: hovered ? SHADOWS.panel : SHADOWS.card,
        outline: hovered ? `1px solid ${GOLD_GLOW.hoverBorder}` : undefined,
        transition: `transform ${DURATION.fast}ms ${EASING.snappy}, box-shadow ${DURATION.fast}ms ${EASING.snappy}`,
        transform: hovered ? 'translateY(-3px)' : 'translateY(0)',
      }}>
      <FrameBackdrop deck={deck} />
      <FrameArt artUrl={artUrl} deckName={name} />
      <NamePlate name={name} />
      <ClassificationStrip deck={deck} authorName={authorName} />
    </Link>
  );
}
