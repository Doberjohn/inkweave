import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';
import {PER_INK} from './setComposition';
import {scatterRanks} from './scatter';

/** Slots per row of the diamond; sums to PER_INK (34). */
const ROWS = [4, 6, 7, 7, 6, 4] as const;

interface CardMosaicProps {
  ink: Ink;
  /** Revealed cards for this ink (placed into scattered slots). */
  cards: LorcanaCard[];
  /** Opens the card modal when a revealed slot is clicked. */
  onOpen?: (card: LorcanaCard) => void;
  /** Mobile sizing: 46×64 slots / 5px gaps instead of 58×80 / 7px. */
  compact?: boolean;
}

/**
 * The featured ink board's diamond: six centered rows [4,6,7,7,6,4] of CardSlots.
 * Revealed cards fill scattered slots (see scatter.ts) so the board lights up
 * across the diamond rather than left-to-right. Lives in an overflow-x rail so
 * it never clips on narrow screens.
 */
export function CardMosaic({ink, cards, onOpen, compact = false}: CardMosaicProps) {
  const rank = scatterRanks(ink.toLowerCase());
  const revealed = [...cards]
    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0))
    .slice(0, PER_INK);
  const slotW = compact ? 46 : 58;
  const slotH = compact ? 64 : 80;
  const gap = compact ? 5 : 7;

  let slot = 0;
  const rows = ROWS.map((width, ri) => {
    const cells = [];
    for (let k = 0; k < width; k++) {
      const s = slot++;
      const card = rank[s] < revealed.length ? revealed[rank[s]] : undefined;
      cells.push(
        <CardSlot key={s} ink={ink} card={card} width={slotW} height={slotH} onOpen={onOpen} />,
      );
    }
    return (
      <div key={ri} style={{display: 'flex', gap, justifyContent: 'center'}}>
        {cells}
      </div>
    );
  });

  return (
    <div style={{overflowX: 'auto', paddingBottom: 4}}>
      <div style={{display: 'flex', flexDirection: 'column', gap, alignItems: 'center', padding: '6px 0'}}>
        {rows}
      </div>
    </div>
  );
}
