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
  ICON_SIZE,
  RADIUS,
  SPACING,
  TABULAR,
  TRUNCATE,
} from '../../../shared/constants';
import {deckTint} from './deckTint';
import type {Deck} from '../types';

interface DeckSummaryCardProps {
  deck: Deck;
  /** Total copies in the deck (every `DeckCard.quantity` summed). */
  cardCount: number;
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
   * and a card shows a name. Omitted rather than defaulted, and the tile renders
   * nothing when it is missing. Both ways of having none are honest: your own list,
   * where every deck is yours and repeating that per tile is noise, and an account
   * with no profile row yet.
   */
  authorName?: string;
}

/** A deck can be saved before it is named; the tile still needs something to read. */
const FALLBACK_NAME = 'Untitled deck';

/**
 * Tile height floor. Deliberately taller than the content needs: it reserves the
 * row where the playstyle line will go, so adding that later does not reflow the
 * whole grid. Not a spacing token, because this is a height, not a gap.
 */
const TILE_MIN_HEIGHT = 148;

/**
 * One deck in either `/decks` list, as a tile carrying its own ink identity.
 *
 * It is an anchor, not a button, because these are real URLs and a list of decks
 * is exactly where middle-click and open-in-new-tab earn their keep.
 *
 * The inks appear as SYMBOLS, not named chips. On a gradient built from those
 * same two inks, a pill reading "Amber" on an amber background says the same
 * thing twice. Dropping the words costs a sighted reader the ability to name an
 * unfamiliar hexagon, so both replacements are wired explicitly: `decorative={false}`
 * puts the name in `alt` for a screen reader, and `showTooltip` puts it in `title`
 * for a mouse. `alt` alone gives no tooltip in any current browser.
 */
export function DeckSummaryCard({deck, cardCount, to, authorName}: DeckSummaryCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to ?? `/decks/${deck.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: SPACING.md,
        minHeight: TILE_MIN_HEIGHT,
        padding: SPACING.lg,
        borderRadius: `${RADIUS.card}px`,
        border: `1px solid ${hovered ? GOLD_GLOW.hoverBorder : COLORS.surfaceBorder}`,
        background: deckTint(deck.inks),
        textDecoration: 'none',
        transition: `border-color ${DURATION.fast}ms ${EASING.snappy}, transform ${DURATION.fast}ms ${EASING.snappy}`,
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
      }}>
      {/*
        Name and author are ONE flex child, not two.

        The tile is `justify-content: space-between` over two children — title block
        at the top, ink/count row pinned to the bottom. A third child would land in
        the middle by definition, so the author has to be grouped with the name it
        belongs to rather than added alongside it.
      */}
      <span style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs, minWidth: 0}}>
        {/*
          Two lines, then ellipsis. The longest real deck name in the wild is 71
          characters and does truncate; accepted rather than shrinking the type.

          `overflowWrap: 'anywhere'` is load-bearing, not belt-and-braces. A grid
          item's `min-width` resolves to min-content, so a name with no break
          opportunity (a pasted URL: nothing caps deck-name length) would push the
          track wider instead of clamping, and a single unbreakable word never
          reaches line 2 to earn its ellipsis. `anywhere` rather than `break-word`
          because only `anywhere` also shrinks the min-content contribution.
        */}
        <span
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
            overflowWrap: 'anywhere',
            color: COLORS.text,
          // Body font, not the hero serif (owner ruling 2026-08-06). Weight 600
          // rather than the serif's regular: the display serif carries a title at
          // its normal weight and the body sans does not, so dropping the serif
          // without adding weight would leave the name reading as body copy.
          // 600 not 700, because 700 is a page's own h1 (see PageTitle).
          //
            // Font names stay out of this comment on purpose: `check:design` greps
            // the literal values behind FONTS.*, comments included.
            fontFamily: FONTS.body,
            fontWeight: 600,
            fontSize: `${FONT_SIZES.xxl}px`,
            lineHeight: 1.25,
          }}>
          {deck.name.trim() || FALLBACK_NAME}
        </span>

        {/*
          The author reads as part of the title, not as another stat in the bottom
          row. The inks and the count answer "what is this deck"; the handle answers
          "whose is it", and putting it here is what makes the community list feel
          like a list of people's decks rather than a list of decks.

          No @ prefix: this is a name, not a handle, and an @ would imply an
          addressable identifier that this string is not (display names are not
          unique — profiles.handle is).
        */}
        {authorName && (
          <span
            style={{
              ...TRUNCATE,
              color: COLORS.textMuted,
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.sm}px`,
            }}>
            {authorName}
          </span>
        )}
      </span>

      <span style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: SPACING.sm}}>
        {/*
          The drop shadow is not decoration. Each symbol carries its own fill and
          stroke in its ink's colour, so an Amber hexagon on the amber end of an
          Amber gradient sits flush against the background it is supposed to be
          read against. The shadow lifts it off without needing a pill.
        */}
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.xs,
            filter: `drop-shadow(0 1px 3px ${blackRgba(0.75)})`,
          }}>
          {deck.inks.map((ink) => (
            <InkIcon key={ink} ink={ink} size={ICON_SIZE.lg} decorative={false} showTooltip />
          ))}
        </span>

        {/*
          Gold, not the muted grey the row used. Owner's call on how it looks; both
          clear AA. Worst case is Emerald, the lightest of the six ink tints, where
          the grey measures 4.84 and gold 7.39.
        */}
        <span
          style={{
            ...TABULAR,
            flexShrink: 0,
            color: COLORS.primary,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.base}px`,
            fontWeight: 600,
          }}>
          {cardCount} {cardCount === 1 ? 'card' : 'cards'}
        </span>
      </span>
    </Link>
  );
}
