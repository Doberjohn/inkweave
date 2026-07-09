import {useDeck} from '../features/deck/state';
import {COLORS, FONTS, SPACING} from '../shared/constants';

/**
 * `/decks/new` and `/decks/:id/edit` — the builder. The full shell + card pool + live
 * advisor land in #467/#468/#472; this scaffold (#466) proves the DeckProvider wiring by
 * reading the working draft.
 */
export function DeckBuilderPage() {
  const {deck} = useDeck();
  const total = deck.cards.reduce((n, c) => n + c.quantity, 0);
  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        padding: SPACING.xl,
        maxWidth: 900,
        margin: '0 auto',
      }}>
      <h1 style={{fontFamily: FONTS.hero, fontSize: 20, color: COLORS.text, margin: 0}}>{deck.name}</h1>
      <p style={{fontFamily: FONTS.body, fontSize: 13, color: COLORS.textMuted, marginTop: SPACING.sm}}>
        {total} / 60 cards{deck.inks.length ? ` · ${deck.inks.join(' / ')}` : ''}
      </p>
      <p style={{fontFamily: FONTS.body, fontSize: 13, color: COLORS.textDim, marginTop: SPACING.lg}}>
        Builder shell, card pool, and live advisor arrive next (#467, #468, #472).
      </p>
    </main>
  );
}
