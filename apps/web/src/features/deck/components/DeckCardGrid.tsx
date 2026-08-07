import {cardPath} from 'inkweave-synergy-engine';
import {CardTile} from '../../cards/components/CardTile';
import {blackRgba, COLORS, FONT_SIZES, FONTS, RADIUS, SPACING, TABULAR} from '../../../shared/constants';
import type {LorcanaCard} from '../types';

export interface DeckCardLine {
  card: LorcanaCard;
  quantity: number;
}

interface DeckCardGridProps {
  /** Already resolved and ordered by the caller — the grid does not sort. */
  lines: readonly DeckCardLine[];
  /** Opens the card. Omit for a purely decorative grid (an export image, a story). */
  onSelectCard?: (card: LorcanaCard) => void;
}

/**
 * Column floor. A Lorcana card is legible from about 130px, so 140 gives six across
 * on desktop — which is what a 60-card deck wants: a typical list is 18-22 distinct
 * cards, and six columns puts that in three or four rows you can take in at once.
 *
 * Exported with the gap so `DeckViewSkeleton` can hold the SAME grid rather than
 * restate it. A skeleton that drifts from the thing it stands in for is worse than
 * none: it promises a layout and then delivers a different one.
 */
export const DECK_GRID_COLUMN = 140;
export const DECK_GRID_GAP = SPACING.md;

/**
 * The copies badge.
 *
 * Top-right, over the card's own art rather than beside it, because the alternative
 * is a caption row under every tile and that doubles the grid's height for one glyph.
 * The card's cost and name are already printed on the image; copies is the only fact
 * the deck knows that the card does not.
 */
function QuantityBadge({quantity}: {quantity: number}) {
  return (
    <span
      aria-hidden
      style={{
        ...TABULAR,
        position: 'absolute',
        top: SPACING.xs,
        right: SPACING.xs,
        padding: `1px ${SPACING.xs}px`,
        borderRadius: `${RADIUS.sm}px`,
        // Solid, not translucent: it sits on card art, which is arbitrary and often
        // light. A tint that reads on one illustration disappears on the next.
        background: blackRgba(0.78),
        color: COLORS.heroTitle,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.md}px`,
        fontWeight: 700,
        lineHeight: 1.4,
        pointerEvents: 'none',
      }}>
      {quantity}x
    </span>
  );
}

/**
 * A deck as a grid of its actual cards, each stamped with how many copies it runs.
 *
 * This replaced a text list of names. A decklist read as text is a lookup table; read
 * as cards it is the thing itself, and a player recognises their own deck at a glance
 * from the art rather than by reading twenty names.
 *
 * The quantity is announced through the tile's own `aria-label` rather than the badge,
 * which is `aria-hidden`. `CardTile` already labels itself with the card's full name,
 * so a badge with its own text would make a screen reader say the name and then "4x"
 * as two unrelated things.
 */
export function DeckCardGrid({lines, onSelectCard}: DeckCardGridProps) {
  return (
    <ul
      aria-label="Deck list"
      style={{
        listStyle: 'none',
        margin: `${SPACING.xxl}px 0 0`,
        padding: 0,
        display: 'grid',
        gridTemplateColumns: `repeat(auto-fill, minmax(${DECK_GRID_COLUMN}px, 1fr))`,
        gap: DECK_GRID_GAP,
      }}>
      {lines.map(({card, quantity}) => (
        <li
          key={card.id}
          // The list item carries the accessible copy count, so it is spoken as part
          // of the card rather than as a stray number after it.
          aria-label={`${quantity} copies of ${card.fullName || card.name}`}
          style={{position: 'relative', margin: 0}}>
          <CardTile
            card={card}
            isSelected={false}
            useSmallImage
            onSelect={onSelectCard}
            // A deck view is a browse surface: `href` makes each card crawlable and
            // middle-clickable, while a plain click stays in the app and opens the
            // card without leaving the deck. `cardPath` and not a hand-built URL —
            // it appends the name slug the catalog's SEO work depends on (#486).
            href={cardPath(card)}
          />
          <QuantityBadge quantity={quantity} />
        </li>
      ))}
    </ul>
  );
}
