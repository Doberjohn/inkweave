import {ALL_INKS, CAP_LABEL_XS, COLORS, FONTS, FONT_SIZES, INK_COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {InkIcon} from '../../../shared/components/InkIcon';
import {InkwellIcon} from '../../../shared/components/InkwellIcon';
import type {CardType, DeckStats} from '../types';

/** Card types in the order the deck list groups them. */
const TYPE_ORDER: readonly CardType[] = ['Character', 'Action', 'Item', 'Location'];

/** One ink's share of the deck: icon, name, proportional bar, count. */
function InkRow({ink, count, total}: {ink: (typeof ALL_INKS)[number]; count: number; total: number}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  const color = INK_COLORS[ink].border;
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm}}>
      <InkIcon ink={ink} size={18} />
      <span style={{color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`, width: 62, flexShrink: 0}}>
        {ink}
      </span>
      <div style={{flex: 1, height: 6, background: COLORS.surfaceAlt, borderRadius: RADIUS.xs, overflow: 'hidden', minWidth: 0}}>
        <div style={{width: `${pct}%`, height: '100%', background: color}} />
      </div>
      <span
        style={{
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          fontVariantNumeric: 'tabular-nums',
          width: 26,
          textAlign: 'right',
          flexShrink: 0,
        }}>
        {count}
      </span>
    </div>
  );
}

/** An inkwell figure: the symbol, its label, and the count. */
function InkwellStat({value, label, count}: {value: 'inkable' | 'uninkable'; label: string; count: number}) {
  return (
    <span style={{display: 'flex', alignItems: 'center', gap: 6, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`}}>
      <InkwellIcon value={value} size={18} />
      {label} <strong style={{color: COLORS.text, fontWeight: 700}}>{count}</strong>
    </span>
  );
}

/**
 * The deck's makeup, as the Profile tab of the deck panel: ink split as
 * proportional bars, the inkable/uninkable balance, and the card-type spread.
 * Reuses the shared InkIcon / InkwellIcon glyphs the old header strip used —
 * this is the same information with room to read it.
 */
export function DeckProfile({stats}: {stats: DeckStats}) {
  const inks = ALL_INKS.filter((ink) => (stats.inkDistribution[ink] ?? 0) > 0);
  const inkTotal = inks.reduce((n, ink) => n + (stats.inkDistribution[ink] ?? 0), 0);
  const types = TYPE_ORDER.filter((t) => (stats.typeDistribution[t] ?? 0) > 0);
  const uninkable = stats.totalCards - stats.inkableCount;

  if (stats.totalCards === 0) {
    return (
      <div style={{padding: SPACING.lg, color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`}}>
        Add cards to see the deck's makeup.
      </div>
    );
  }

  return (
    <div style={{padding: `${SPACING.md}px ${SPACING.lg}px`, display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.sm}}>
        {inks.map((ink) => (
          <InkRow key={ink} ink={ink} count={stats.inkDistribution[ink] ?? 0} total={inkTotal} />
        ))}
      </div>

      <div style={{display: 'flex', gap: SPACING.lg, flexWrap: 'wrap', borderTop: `1px solid ${COLORS.surfaceBorder}`, paddingTop: SPACING.md}}>
        <InkwellStat value="inkable" label="Inkable" count={stats.inkableCount} />
        <InkwellStat value="uninkable" label="Uninkable" count={uninkable} />
      </div>

      <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.xs}}>
        <div style={CAP_LABEL_XS}>Card types</div>
        <div style={{display: 'flex', gap: SPACING.lg, flexWrap: 'wrap', color: COLORS.textMuted, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.md}px`}}>
          {types.map((type) => (
            <span key={type}>
              {type} <strong style={{color: COLORS.text, fontWeight: 700}}>{stats.typeDistribution[type]}</strong>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
