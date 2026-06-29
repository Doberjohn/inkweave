import {useRef, useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';
import {mobileSlotWidth} from './mosaicSizing';
import {useContainerWidth} from '../../shared/hooks';

/** Slots per row of the diamond; sums to BOARD_SLOTS (38). Grown from the old 34
 *  so each card can sit at its true collector-number position (Set 13 numbers each
 *  ink across ~37-38 numbers — the 34 app cards plus the excluded enchanted/iconic
 *  that leave gaps). */
const ROWS = [4, 7, 8, 8, 7, 4] as const;
/** Mobile diamond — narrower and taller so the widest row fits a phone. Sums to BOARD_SLOTS. */
const ROWS_MOBILE = [3, 4, 6, 6, 6, 6, 4, 3] as const;
const BOARD_SLOTS = 38;

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

/**
 * Lay the revealed cards into the 38 slots by collector number. In-range numbered
 * cards (number-base ∈ [0,37]) claim their exact slot. Anything that can't be
 * placed absolutely — cards numbered outside the block (e.g. a mis-tagged outlier)
 * or with no number at all — fills the remaining gaps from the end so every
 * revealed card still shows.
 */
/** The card's absolute slot from its collector number, or -1 if it can't claim one. */
function slotFor(card: LorcanaCard, base: number): number {
  if (card.setNumber == null) return -1;
  const slot = card.setNumber - base;
  return slot >= 0 && slot < BOARD_SLOTS ? slot : -1;
}

/** Empty slot indices, highest first — where leftover cards spill in. */
function emptySlotsFromEnd(placed: (LorcanaCard | undefined)[]): number[] {
  const empty: number[] = [];
  for (let i = BOARD_SLOTS - 1; i >= 0; i--) {
    if (placed[i] == null) empty.push(i);
  }
  return empty;
}

function placeCards(ink: Ink, cards: LorcanaCard[]): (LorcanaCard | undefined)[] {
  const placed: (LorcanaCard | undefined)[] = new Array(BOARD_SLOTS).fill(undefined);
  const base = INK_BASE[ink];
  const leftovers: LorcanaCard[] = [];

  for (const card of cards) {
    const slot = slotFor(card, base);
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
 * The featured ink board's diamond of CardSlots (BOARD_SLOTS = 38). Desktop uses
 * the wide [4,7,8,8,7,4] rows; mobile uses the narrower/taller ROWS_MOBILE and
 * auto-fits the slot size to the measured rail width so all cards fit with no
 * horizontal scroll. Each revealed card sits at its true collector-number slot
 * (see placeCards), so unrevealed numbers show as fallback gaps and the board
 * reads in set order.
 */
export function CardMosaic({ink, cards, onOpen, compact = false}: CardMosaicProps) {
  const placed = placeCards(ink, cards);
  const railRef = useRef<HTMLDivElement>(null);
  const containerW = useContainerWidth(railRef);
  const rowWidths = compact ? ROWS_MOBILE : ROWS;
  const maxCols = Math.max(...rowWidths);
  const gap = compact ? 5 : 7;

  const slotW = compact ? mobileSlotWidth(containerW, maxCols, gap) : 58;
  const slotH = compact ? Math.round(slotW * CARD_RATIO) : 80;

  // Pick the random slots to pop once per mount. The parent keys this component
  // by ink, so switching colors re-mounts it and a fresh set bursts in each time.
  const [poppedSlots] = useState(() => {
    const filled: number[] = [];
    for (let s = 0; s < BOARD_SLOTS; s++) {
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
