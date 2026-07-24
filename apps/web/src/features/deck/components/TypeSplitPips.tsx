import {CAP_LABEL, COLORS, FONTS, FONT_SIZES, SPACING} from '../../../shared/constants';
import type {CardType} from '../types';

interface TypeSplitPipsProps {
  /** Copies per card type, from calculateDeckStats (Character/Action/Item/Location). */
  typeDistribution: Partial<Record<CardType, number>>;
}

/** One rendered pip: a card type and how many copies of it the deck holds. */
interface TypePip {
  type: CardType;
  count: number;
}

/**
 * Canonical display order — mirrors the deck-list grouping order so the pips read
 * in the same sequence as the type-grouped rows above them.
 */
const TYPE_ORDER: readonly CardType[] = ['Character', 'Action', 'Item', 'Location'];

/**
 * Turn the raw type distribution into the ordered list of pips to render:
 * canonical TYPE_ORDER (so the pips read in the same sequence as the type-grouped
 * rows above), omitting any type the deck doesn't currently hold. Empty deck -> [].
 */
function buildTypePips(typeDistribution: Partial<Record<CardType, number>>): TypePip[] {
  return TYPE_ORDER.flatMap((type) => {
    const count = typeDistribution[type] ?? 0;
    return count > 0 ? [{type, count}] : [];
  });
}

/**
 * The type split of the DeckStatsBar (#468): a compact, neutral row of
 * "{count} {Type}" pips shown beside the CostCurveStrip above the Cards-tab
 * list. Presentation-only — reads calculateDeckStats' typeDistribution. Neutral
 * by ruling (no per-type color token); the count is emphasized, the label muted.
 * Hidden while the deck holds no cards.
 */
export function TypeSplitPips({typeDistribution}: TypeSplitPipsProps) {
  const pips = buildTypePips(typeDistribution);
  if (pips.length === 0) return null;

  return (
    <section
      aria-label="Card type split"
      style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm, padding: '15px 15px 8px 15px', flexShrink: 0}}>
      <div style={CAP_LABEL}>Types</div>
      <div style={{display: 'flex', flexWrap: 'wrap', columnGap: SPACING.md, rowGap: SPACING.sm}}>
        {pips.map((pip) => (
          <span
            key={pip.type}
            style={{
              fontFamily: FONTS.body,
              fontSize: `${FONT_SIZES.sm}px`,
              color: COLORS.textMuted,
              fontVariantNumeric: 'tabular-nums',
            }}>
            <span style={{color: COLORS.text, fontWeight: 700}}>{pip.count}</span> {pip.type}
          </span>
        ))}
      </div>
    </section>
  );
}
