import {Chip} from 'inkweave-ui/components/Chip';
import {COLORS, ICON_SIZE, SPACING, TABULAR, VISUALLY_HIDDEN, hexRgba} from '../../shared/constants';
import {RARITIES, type RarityConfig} from 'inkweave-ui/lib/rarity';
import {RaritySymbol} from 'inkweave-ui/lorcana/RaritySymbol';

interface RarityBreakdownProps {
  /** Revealed count per rarity key (from useRevealProgress). */
  rarityCounts: Record<string, number>;
  /** The board's special printing rarities (Epic, Enchanted, Iconic), shown after the five. */
  specialRarities?: readonly RarityConfig[];
  /** Touch sizing for the chips. */
  compact?: boolean;
  /** The highlighted rarity key, or null when none is active. */
  selectedRarity?: string | null;
  /** Toggle a rarity highlight. */
  onSelectRarity: (key: string) => void;
}

/**
 * Per-rarity tally for an ink board, as the kit's toggle chips: each rarity with
 * revealed cards shows its real symbol, its name and the live revealed count, and
 * toggles the highlight of that rarity in the board. A rarity with nothing revealed
 * has nothing to highlight, so it gets no chip. The special printing rarities
 * follow the main-set five. On a phone the name is left to screen readers so the
 * chips fit two rows.
 */
export function RarityBreakdown({
  rarityCounts,
  specialRarities = [],
  compact = false,
  selectedRarity = null,
  onSelectRarity,
}: RarityBreakdownProps) {
  const revealed = [...RARITIES, ...specialRarities].filter((rarity) => (rarityCounts[rarity.key] ?? 0) > 0);
  if (!revealed.length) return null;

  return (
    <div style={{borderTop: `1px solid ${hexRgba(COLORS.surfaceBorder, 0.6)}`, marginTop: SPACING.xxl, paddingTop: SPACING.lg}}>
      <div
        role="group"
        aria-label="Highlight a rarity"
        style={{display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: SPACING.sm}}
      >
        {revealed.map((rarity) => (
          <Chip
            key={rarity.key}
            label=""
            active={selectedRarity === rarity.key}
            onClick={() => onSelectRarity(rarity.key)}
            isMobile={compact}
            title={`Highlight ${rarity.name} cards`}
          >
            <RaritySymbol rarity={rarity.key} size={ICON_SIZE.sm} />
            {/* Read by screen readers, not shown: a phone chip is its symbol and count alone. */}
            <span style={compact ? VISUALLY_HIDDEN : undefined}>{rarity.name}</span>{' '}
            <span style={{...TABULAR, fontWeight: 700}}>{rarityCounts[rarity.key]}</span>
          </Chip>
        ))}
      </div>
    </div>
  );
}
