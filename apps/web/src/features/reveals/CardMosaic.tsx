import {useRef, useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';
import {mobileSlotWidth} from './mosaicSizing';
import {PER_INK} from './setComposition';
import {useContainerWidth} from '../../shared/hooks';

/**
 * Per-ink diamond row layouts. Each ink's rows sum to its PER_INK total — Set 13
 * splits 207 cards as Amber 37 · Amethyst 36 · Emerald 35 · Ruby 34 · Sapphire 33
 * · Steel 32 — so every ink board renders exactly that many slots. Desktop peaks
 * at 8 columns; mobile peaks at 6 so the widest row fits a phone. The
 * `cardMosaic.test.ts` "layouts" suite asserts each row set sums to PER_INK[ink],
 * so a hand-edited layout that drifts from the composition fails the build.
 */
export const ROWS: Record<Ink, readonly number[]> = {
  Amber: [4, 6, 8, 8, 7, 4], // 37
  Amethyst: [4, 6, 8, 8, 6, 4], // 36
  Emerald: [4, 6, 8, 7, 6, 4], // 35
  Ruby: [4, 6, 7, 7, 6, 4], // 34
  Sapphire: [4, 6, 7, 6, 6, 4], // 33
  Steel: [4, 6, 6, 6, 6, 4], // 32
};
/** Mobile diamonds — narrower (peak 6) and taller so the widest row fits a phone. */
export const ROWS_MOBILE: Record<Ink, readonly number[]> = {
  Amber: [3, 4, 6, 6, 6, 5, 4, 3], // 37
  Amethyst: [3, 4, 5, 6, 6, 5, 4, 3], // 36
  Emerald: [3, 4, 5, 6, 5, 5, 4, 3], // 35
  Ruby: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Sapphire: [3, 4, 5, 5, 5, 4, 4, 3], // 33
  Steel: [3, 4, 4, 5, 5, 4, 4, 3], // 32
};

/** Card slot proportion (height / width) — preserved when the mobile slot auto-fits. */
const CARD_RATIO = 64 / 46;

/** How many random revealed slots burst in on each ink switch. */
const POP_COUNT = 5;

/**
 * First collector number of each ink's block. A card's slot is `number - base`,
 * so the lowest-numbered card lands at (or near) slot 0 and the rest read across
 * in true set order, leaving fallback gaps for unrevealed numbers. Amber anchors
 * on the set's #1 (so unrevealed low numbers show as leading gaps); the others
 * anchor on their first revealed card, since their exact block start isn't
 * knowable from the revealed subset alone.
 */
const INK_BASE: Record<Ink, number> = {
  Amber: 1,
  Amethyst: 38,
  Emerald: 74,
  Ruby: 113,
  Sapphire: 148,
  Steel: 178,
};

function pickRandom(pool: number[], n: number): Set<number> {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return new Set(a.slice(0, n));
}

/** The card's absolute slot from its collector number, or -1 if it can't claim one. */
function slotFor(card: LorcanaCard, base: number, slotCount: number): number {
  if (card.setNumber == null) return -1;
  const slot = card.setNumber - base;
  return slot >= 0 && slot < slotCount ? slot : -1;
}

/** Empty slot indices, highest first — where leftover cards spill in. */
function emptySlotsFromEnd(placed: (LorcanaCard | undefined)[]): number[] {
  const empty: number[] = [];
  for (let i = placed.length - 1; i >= 0; i--) {
    if (placed[i] == null) empty.push(i);
  }
  return empty;
}

/**
 * Lay the revealed cards into the ink's `slotCount` slots by collector number.
 * In-range numbered cards (number-base ∈ [0,slotCount)) claim their exact slot.
 * Anything that can't be placed absolutely — cards numbered outside the block or
 * with no number — fills the remaining gaps from the end so every revealed card
 * still shows.
 */
function placeCards(ink: Ink, cards: LorcanaCard[], slotCount: number): (LorcanaCard | undefined)[] {
  const placed: (LorcanaCard | undefined)[] = new Array(slotCount).fill(undefined);
  const base = INK_BASE[ink];
  const leftovers: LorcanaCard[] = [];

  for (const card of cards) {
    const slot = slotFor(card, base, slotCount);
    if (slot >= 0 && placed[slot] == null) {
      placed[slot] = card;
    } else {
      leftovers.push(card);
    }
  }

  // Spill outliers / numberless cards into the remaining gaps from the end.
  const empty = emptySlotsFromEnd(placed);
  leftovers.forEach((card, i) => {
    if (i < empty.length) placed[empty[i]] = card;
  });
  return placed;
}

interface CardMosaicProps {
  ink: Ink;
  /** Revealed cards for this ink (placed by collector number). */
  cards: LorcanaCard[];
  /** Opens the card modal when a revealed slot is clicked. */
  onOpen?: (card: LorcanaCard) => void;
  /** Mobile sizing: 46×64 slots / 5px gaps instead of 58×80 / 7px. */
  compact?: boolean;
}

/**
 * The featured ink board's diamond of CardSlots, sized to the ink's PER_INK total
 * (37 for Amber … 32 for Steel). Desktop uses the wider `ROWS[ink]`; mobile uses
 * the narrower/taller `ROWS_MOBILE[ink]` and auto-fits the slot size to the
 * measured rail width so all cards fit with no horizontal scroll. Each revealed
 * card sits at its true collector-number slot (see placeCards), so unrevealed
 * numbers show as fallback gaps and the board reads in set order.
 */
export function CardMosaic({ink, cards, onOpen, compact = false}: CardMosaicProps) {
  const rowWidths = compact ? ROWS_MOBILE[ink] : ROWS[ink];
  const slotCount = PER_INK[ink]; // === sum(rowWidths); guarded by cardMosaic.test.ts
  const placed = placeCards(ink, cards, slotCount);
  const railRef = useRef<HTMLDivElement>(null);
  const containerW = useContainerWidth(railRef);
  const maxCols = Math.max(...rowWidths);
  const gap = compact ? 5 : 7;

  const slotW = compact ? mobileSlotWidth(containerW, maxCols, gap) : 58;
  const slotH = compact ? Math.round(slotW * CARD_RATIO) : 80;

  // Pick the random slots to pop once per mount. The parent keys this component
  // by ink, so switching colors re-mounts it and a fresh set bursts in each time.
  const [poppedSlots] = useState(() => {
    const filled: number[] = [];
    for (let s = 0; s < slotCount; s++) {
      if (placed[s] != null) filled.push(s);
    }
    return pickRandom(filled, POP_COUNT);
  });

  let slot = 0;
  const rows = rowWidths.map((width, ri) => {
    const cells = [];
    for (let k = 0; k < width; k++) {
      const s = slot++;
      cells.push(
        <CardSlot
          key={s}
          ink={ink}
          card={placed[s]}
          width={slotW}
          height={slotH}
          onOpen={onOpen}
          animate={poppedSlots.has(s)}
        />,
      );
    }
    return (
      <div key={ri} style={{display: 'flex', gap, justifyContent: 'center'}}>
        {cells}
      </div>
    );
  });

  return (
    <div ref={railRef} style={{overflowX: compact ? 'visible' : 'auto', paddingBottom: 4}}>
      <div style={{display: 'flex', flexDirection: 'column', gap, alignItems: 'center', padding: '6px 0'}}>
        {rows}
      </div>
    </div>
  );
}
