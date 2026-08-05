import {useState} from 'react';
import {Link} from 'react-router-dom';
import {InkChip} from './InkChip';
import {
  COLORS,
  DURATION,
  EASING,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  SPACING,
  SURFACE_CARD,
  TABULAR,
  TRUNCATE,
} from '../../../shared/constants';
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
}

/** A deck can be saved before it is named; the row still needs something to read. */
const FALLBACK_NAME = 'Untitled deck';

/**
 * One deck in either `/decks` list: name, inks, size.
 *
 * It is an anchor, not a button, because these are real URLs and a list of decks
 * is exactly where middle-click and open-in-new-tab earn their keep.
 */
export function DeckSummaryCard({deck, cardCount, to}: DeckSummaryCardProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <Link
      to={to ?? `/decks/${deck.id}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        ...SURFACE_CARD,
        // Full shorthand rather than a borderColor override: SURFACE_CARD already
        // sets `border`, and two competing declarations resolve by key order.
        border: `1px solid ${hovered ? GOLD_GLOW.hoverBorder : COLORS.surfaceBorder}`,
        background: hovered ? COLORS.surfaceHover : COLORS.surface,
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.md,
        textDecoration: 'none',
        transition: `background ${DURATION.fast}ms ${EASING.snappy}, border-color ${DURATION.fast}ms ${EASING.snappy}`,
      }}>
      {/* minWidth: 0 is what lets the name below actually truncate instead of
          forcing the row wider than its container. */}
      <span style={{flex: 1, minWidth: 0}}>
        <span
          style={{
            ...TRUNCATE,
            display: 'block',
            color: COLORS.text,
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.xl}px`,
            fontWeight: 600,
          }}>
          {deck.name.trim() || FALLBACK_NAME}
        </span>
      </span>

      <span style={{display: 'flex', gap: SPACING.xs, flexShrink: 0}}>
        {deck.inks.map((ink) => (
          <InkChip key={ink} ink={ink} />
        ))}
      </span>

      <span
        style={{
          ...TABULAR,
          flexShrink: 0,
          color: COLORS.textMuted,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.lg}px`,
          fontWeight: 600,
        }}>
        {cardCount} {cardCount === 1 ? 'card' : 'cards'}
      </span>
    </Link>
  );
}
