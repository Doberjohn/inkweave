import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, LINE_HEIGHT, SPACING} from '../../../shared/constants';
import {cardFacts} from '../cardFacts';

const TEXT = {
  fontSize: `${FONT_SIZES.sm}px`,
  lineHeight: LINE_HEIGHT.relaxed,
  color: COLORS.textMuted,
};

/**
 * The card's printed facts as a sentence, under its rules text on the card page: text a reader
 * and a search engine can read, where the card image only shows them. It sits closed under a
 * "Card facts" line (index.css's `.text-disclosure`) until a visitor opens it, below the text, so the name,
 * chips and art keep their places; the phone card's loading state holds that line
 * (`CardDetailLoading`).
 */
export function CardFacts({card}: {card: LorcanaCard}) {
  return (
    <details className="text-disclosure" data-testid="card-facts" style={TEXT}>
      <summary>Card facts</summary>
      <p style={{margin: `${SPACING.xs}px 0 0`}}>{cardFacts(card)}</p>
    </details>
  );
}
