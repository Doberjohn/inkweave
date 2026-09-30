import {useRef} from 'react';
import type {CardPrinting, Ink, LorcanaCard, VariantRarity} from 'inkweave-synergy-engine';
import {CAP_LABEL_XS, COLORS, FONT_SIZES, ICON_SIZE, SPACING, TABULAR, hexRgba} from '../../shared/constants';
import {useContainerWidth} from '../../shared/hooks';
import {CardSlot} from './CardSlot';
import {ROWS_MOBILE} from './CardMosaic';
import {RaritySymbol} from './RaritySymbol';
import {isNarrowSlot, slotSize} from './mosaicSizing';
import {isSpecialSlotDimmed, SPECIAL_RARITIES} from './rarity';
import type {SpecialSlot} from './useRevealProgress';

interface SpecialPrintingsProps {
  ink: Ink;
  /** The ink's special printing slots, from useRevealProgress. */
  slots: SpecialSlot[];
  /** Opens the card modal on a revealed printing. */
  onOpenPrinting?: (card: LorcanaCard, printing: CardPrinting) => void;
  /** Mobile sizing, and two short rows instead of one. */
  compact?: boolean;
  /** The highlighted rarity key, or null when none is active. */
  selectedRarity?: string | null;
}

interface RarityGroup {
  rarity: VariantRarity;
  slots: SpecialSlot[];
}

type SlotSize = ReturnType<typeof slotSize>;

/**
 * The slots grouped by rarity in lineup order: the Epics, the Enchanteds, then any Iconic. A
 * printing appended outside the lineup joins its own rarity's group, so each rarity is one group.
 */
function groupByRarity(slots: SpecialSlot[]): RarityGroup[] {
  const rarities = [...new Set(slots.map((slot) => slot.rarity))];
  return rarities.map((rarity) => ({
    rarity,
    slots: slots.filter((slot) => slot.rarity === rarity),
  }));
}

/** Desktop lays every group on one row; a phone puts the first group (the Epics) above the rest. */
function rowsOf(groups: RarityGroup[], compact: boolean): RarityGroup[][] {
  if (!groups.length) return [];
  return compact && groups.length > 1 ? [groups.slice(0, 1), groups.slice(1)] : [groups];
}

/** A revealed slot opens the modal on its printing; an unrevealed one is not clickable. */
function openerFor(
  slot: SpecialSlot,
  onOpenPrinting: SpecialPrintingsProps['onOpenPrinting'],
): ((card: LorcanaCard) => void) | undefined {
  const {printing} = slot;
  if (!printing || !onOpenPrinting) return undefined;
  return (card) => onOpenPrinting(card, printing);
}

interface RaritySlotsProps {
  ink: Ink;
  group: RarityGroup;
  size: SlotSize;
  onOpenPrinting: SpecialPrintingsProps['onOpenPrinting'];
  selectedRarity: string | null;
}

/** One rarity's slots under its symbol and name. Unrevealed slots show the rarity symbol. */
function RaritySlots({ink, group, size, onOpenPrinting, selectedRarity}: RaritySlotsProps) {
  const {key, name} = SPECIAL_RARITIES[group.rarity];
  const emblemSize = isNarrowSlot(size.width) ? ICON_SIZE.md : ICON_SIZE.lg;
  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.sm}}>
      <span style={{...CAP_LABEL_XS, display: 'flex', alignItems: 'center', gap: SPACING.xs}}>
        <RaritySymbol rarity={key} size={ICON_SIZE.sm} />
        {name}
      </span>
      <div style={{display: 'flex', gap: size.gap}}>
        {group.slots.map((slot) => (
          <CardSlot
            key={slot.number}
            ink={ink}
            card={slot.card}
            printing={slot.printing}
            width={size.width}
            height={size.height}
            onOpen={openerFor(slot, onOpenPrinting)}
            dimmed={isSpecialSlotDimmed(slot.rarity, selectedRarity)}
            emblem={<RaritySymbol rarity={key} size={emblemSize} />}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The ink board's special printings (#625), labelled "Alt arts" for players: a slot for each of
 * the ink's Epic, Enchanted and Iconic printings, filled with its art once revealed. They are
 * alternate art of cards on the board, not cards of their own, so they sit in their own row with
 * their own count and leave the board's "N / 34" alone. Slots match the diamond's size, and a
 * revealed one opens the card modal on that printing.
 */
export function SpecialPrintings({ink, slots, onOpenPrinting, compact = false, selectedRarity = null}: SpecialPrintingsProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const containerW = useContainerWidth(railRef);
  // The diamond's widest phone row sets the fit, so these slots match the ones above.
  const size = slotSize(compact, containerW, Math.max(...ROWS_MOBILE[ink]));
  const revealed = slots.filter((slot) => slot.printing).length;
  const rows = rowsOf(groupByRarity(slots), compact);

  return (
    <div
      role="group"
      aria-label="Alt arts"
      data-testid="special-printings"
      style={{marginTop: SPACING.xxl, paddingTop: SPACING.lg, borderTop: `1px solid ${hexRgba(COLORS.surfaceBorder, 0.6)}`}}
    >
      <div style={{display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: SPACING.md}}>
        <span style={CAP_LABEL_XS}>Alt arts</span>
        <span style={{...TABULAR, fontSize: FONT_SIZES.base, fontWeight: 700, color: COLORS.text}}>
          {revealed}
          <span style={{color: COLORS.textDim}}> / {slots.length}</span>
        </span>
      </div>
      <div ref={railRef} style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
        {rows.map((row) => (
          <div key={row[0].rarity} style={{display: 'flex', justifyContent: 'center', gap: SPACING.xl}}>
            {row.map((group) => (
              <RaritySlots
                key={group.rarity}
                ink={ink}
                group={group}
                size={size}
                onOpenPrinting={onOpenPrinting}
                selectedRarity={selectedRarity}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
