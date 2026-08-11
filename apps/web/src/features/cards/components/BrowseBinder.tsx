import {useState} from 'react';
import {cardPath, type LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from './CardTile';
import {BinderSpread, PER_SPREAD} from './BinderSpread';

/**
 * Browse as a binder (#553 design spike).
 *
 * COMPACTING, not fixed slots (owner ruling 2026-08-11). Results fill spreads in
 * order, so 36 matches is 2 spreads and never 9 with gaps. Paging is a slice over
 * the array `applyFiltersAndSort` already returns, so filters and sorts behave
 * exactly as they do in the grid and no filter logic moves.
 *
 * All of the LOOK lives in `BinderSpread`; this file is only the fill rule.
 *
 * Reachable via `?view=binder` while the design is settled.
 */

interface BrowseBinderProps {
  /** Already filtered and sorted by the page — this only slices it. */
  cards: LorcanaCard[];
  onCardSelect: (card: LorcanaCard) => void;
}

export function BrowseBinder({cards, onCardSelect}: BrowseBinderProps) {
  const [spread, setSpread] = useState(0);
  const total = Math.max(1, Math.ceil(cards.length / PER_SPREAD));
  // Clamped rather than reset: a filter that shrinks the results while the reader
  // is on spread 30 should land them on the last one, not silently on page 1.
  const current = Math.min(spread, total - 1);
  const start = current * PER_SPREAD;

  return (
    <BinderSpread
      start={start}
      label={`Spread ${current + 1} of ${total} · cards ${start + 1}–${Math.min(start + PER_SPREAD, cards.length)} of ${cards.length}`}
      onPrev={() => setSpread(current - 1)}
      onNext={() => setSpread(current + 1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      renderSlot={(index) => {
        const card = cards[index];
        if (!card) return null;
        return (
          <CardTile
            card={card}
            href={cardPath(card)}
            isSelected={false}
            onSelect={onCardSelect}
            variant="minimal"
            // Square, via the prop CardTile already exposes. A real card in a
            // sleeve shows its own printed corners; a CSS radius clips them and
            // reads as a rounded sticker sitting on the page.
            borderRadius={0}
            priority={index - start < 4}
            useSmallImage
          />
        );
      }}
    />
  );
}
