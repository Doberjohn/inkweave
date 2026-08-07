import type {LorcanaCard} from '../../cards';
import type {Deck} from '../types';

type CardLookup = (id: string) => LorcanaCard | undefined;

/**
 * The card whose art represents a deck.
 *
 * CHARACTERS ONLY, most expensive first. A face is what makes a card memorable; a
 * song or an item is a scene, and at tile size a scene reads as texture. The most
 * expensive character is also usually the deck's payoff, which is the card a builder
 * would name if you asked them what the deck does.
 *
 * The tie-break is the point of the sort, not an afterthought. A 60-card deck often
 * runs several characters at its top cost, and a rule that picked "the first one"
 * would depend on `deck.cards` order — so the same deck would change its face when a
 * card was removed and re-added. Cost, then name, then id makes it stable. Card ids
 * are strings, so that last comparison is lexicographic rather than numeric — which
 * is arbitrary, but arbitrary and STABLE is the whole requirement. It is there
 * because two Core cards can share a name across versions.
 *
 * Returns undefined for a deck with no characters, which is a real state (an empty
 * draft, or a pile of actions mid-build) and not an error.
 */
export function signatureCard(deck: Deck, getCardById: CardLookup): LorcanaCard | undefined {
  const characters = deck.cards
    .map((entry) => getCardById(entry.cardId))
    .filter((card): card is LorcanaCard => card?.type === 'Character');

  if (characters.length === 0) return undefined;

  return characters.reduce((best, card) => {
    if (card.cost !== best.cost) return card.cost > best.cost ? card : best;
    if (card.name !== best.name) return card.name < best.name ? card : best;
    return card.id < best.id ? card : best;
  });
}
