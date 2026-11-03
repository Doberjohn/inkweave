import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONT_SIZES, LINE_HEIGHT} from '../../../shared/constants';
import {cardFacts} from '../cardFacts';

/**
 * The card's printed facts as a sentence, under its rules text on the card page: text a reader
 * and a search engine can read, where the card image only shows them. It sits below the text,
 * so the name, chips and art keep their places; the phone card's loading state holds its lines
 * (`CardDetailLoading`).
 */
export function CardFacts({card}: {card: LorcanaCard}) {
  return (
    <p
      data-testid="card-facts"
      style={{
        margin: 0,
        fontSize: `${FONT_SIZES.sm}px`,
        lineHeight: LINE_HEIGHT.relaxed,
        color: COLORS.textMuted,
      }}>
      {cardFacts(card)}
    </p>
  );
}
