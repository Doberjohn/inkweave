import {useRef, useState} from 'react';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';
import {isSlotDimmed} from './slotDimming';
import {slotSize} from './mosaicSizing';
import {PER_INK} from './setComposition';
import {placeCards} from './boardOrder';
import {useContainerWidth} from '../../shared/hooks';
import {SPACING} from '../../shared/constants';

/**
 * Per-ink diamond row layouts. Each ink's rows sum to its PER_INK total, so every
 * ink board renders exactly that many slots. Set 14 is an even 34 per ink, so all
 * six boards share one shape; the table stays per-ink because a set can split
 * unevenly (Set 13 ran 37 down to 32). Desktop peaks at 7 columns; mobile peaks at
 * 5 so the widest row fits a phone. The `cardMosaic.test.ts` "layouts" suite
 * asserts each row set sums to PER_INK[ink], so a hand-edited layout that drifts
 * from the composition fails the build.
 */
export const ROWS: Record<Ink, readonly number[]> = {
  Amber: [4, 6, 7, 7, 6, 4], // 34
  Amethyst: [4, 6, 7, 7, 6, 4], // 34
  Emerald: [4, 6, 7, 7, 6, 4], // 34
  Ruby: [4, 6, 7, 7, 6, 4], // 34
  Sapphire: [4, 6, 7, 7, 6, 4], // 34
  Steel: [4, 6, 7, 7, 6, 4], // 34
};
/** Mobile diamonds: narrower (peak 5) and taller so the widest row fits a phone. */
export const ROWS_MOBILE: Record<Ink, readonly number[]> = {
  Amber: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Amethyst: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Emerald: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Ruby: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Sapphire: [3, 4, 5, 5, 5, 5, 4, 3], // 34
  Steel: [3, 4, 5, 5, 5, 5, 4, 3], // 34
};

/** How many random revealed slots burst in on each ink switch. */
const POP_COUNT = 5;

function pickRandom(pool: number[], n: number): Set<number> {
  const a = [...pool];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return new Set(a.slice(0, n));
}

interface CardMosaicProps {
  ink: Ink;
  /** Revealed cards for this ink (placed by collector number). */
  cards: LorcanaCard[];
  /** Opens the card modal when a revealed slot is clicked. */
  onOpen?: (card: LorcanaCard) => void;
  /** Mobile sizing: 46×64 slots / 5px gaps instead of 58×80 / 7px. */
  compact?: boolean;
  /** The highlighted rarity key, or null when none is active. */
  selectedRarity?: string | null;
}

/**
 * The featured ink board's diamond of CardSlots, sized to the ink's PER_INK
 * total. Desktop uses the wider `ROWS[ink]`; mobile uses
 * the narrower/taller `ROWS_MOBILE[ink]` and auto-fits the slot size to the
 * measured rail width so all cards fit with no horizontal scroll. Each revealed
 * card sits at its true collector-number slot (see placeCards), so unrevealed
 * numbers show as fallback gaps and the board reads in set order.
 */
export function CardMosaic({ink, cards, onOpen, compact = false, selectedRarity = null}: CardMosaicProps) {
  const rowWidths = compact ? ROWS_MOBILE[ink] : ROWS[ink];
  const slotCount = PER_INK[ink]; // === sum(rowWidths); guarded by cardMosaic.test.ts
  const placed = placeCards(ink, cards, slotCount);
  const railRef = useRef<HTMLDivElement>(null);
  const containerW = useContainerWidth(railRef);
  const {width: slotW, height: slotH, gap} = slotSize(compact, containerW, Math.max(...rowWidths));

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
          dimmed={isSlotDimmed(placed[s], selectedRarity)}
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
    <div ref={railRef} style={{overflowX: compact ? 'visible' : 'auto', paddingBottom: SPACING.xs}}>
      <div style={{display: 'flex', flexDirection: 'column', gap, alignItems: 'center', padding: `${SPACING.sm}px 0`}}>
        {rows}
      </div>
    </div>
  );
}
