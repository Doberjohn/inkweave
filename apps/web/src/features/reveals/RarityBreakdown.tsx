import {RARITIES, type RarityConfig} from './rarity';
import {RaritySymbol} from './RaritySymbol';

interface RarityBreakdownProps {
  /** Revealed count per rarity key (from useRevealProgress). */
  rarityCounts: Record<string, number>;
  /** Mobile sizing: all five gems in one row (gem + count, no name labels) / smaller gems. */
  compact?: boolean;
}

/**
 * One vertical stat chip: the rarity symbol over the revealed count over the
 * name (the name is dropped on mobile so all five chips fit one row). Held to its
 * own component so the per-chip `has`/`compact` conditionals don't pile onto
 * RarityBreakdown's complexity.
 */
function RarityChip({rarity, revealed, compact}: {rarity: RarityConfig; revealed: number; compact: boolean}) {
  const has = revealed > 0;
  // One size lookup keyed on `compact` instead of five parallel ternaries — keeps
  // RarityChip's cyclomatic complexity below the CodeScene threshold.
  const dims = compact
    ? {gap: 5, padding: '10px 4px', symHeight: 22, symSize: 20, count: 18}
    : {gap: 8, padding: '14px 8px', symHeight: 32, symSize: 30, count: 28};
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: dims.gap,
        padding: dims.padding,
        background: has ? 'rgba(255, 255, 255, 0.035)' : 'rgba(255, 255, 255, 0.012)',
        border: '1px solid #25253c',
        borderRadius: 12,
        opacity: has ? 1 : 0.65,
      }}
    >
      <div style={{height: dims.symHeight, display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
        <RaritySymbol rarity={rarity.key} size={dims.symSize} />
      </div>
      <div style={{fontWeight: 800, fontSize: dims.count, color: has ? '#f0f0f5' : '#55556e', lineHeight: 1}}>
        {revealed}
      </div>
      {!compact && (
        <div style={{fontWeight: 600, fontSize: 10, letterSpacing: 0.7, textTransform: 'uppercase', color: '#8a8aa4'}}>
          {rarity.name}
        </div>
      )}
    </div>
  );
}

/**
 * Per-rarity tally for an ink board: each of the five rarities shows its real
 * symbol, the actual number of revealed cards of that rarity, and its name. The
 * count is the live tally from the data (no hardcoded total / denominator — the
 * set's real composition differs from the old 12/9/8/3/2 assumption).
 *
 * The divider spans the full board, but the five chips are held to a centered
 * band so they read as a tidy row.
 */
export function RarityBreakdown({rarityCounts, compact = false}: RarityBreakdownProps) {
  return (
    <div style={{borderTop: '1px solid #22223a', marginTop: 22, paddingTop: 16}}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: compact ? 6 : 12,
          maxWidth: compact ? undefined : 680,
          margin: compact ? undefined : '0 auto',
        }}
      >
        {RARITIES.map((r) => (
          <RarityChip key={r.key} rarity={r} revealed={rarityCounts[r.key] ?? 0} compact={compact} />
        ))}
      </div>
    </div>
  );
}
