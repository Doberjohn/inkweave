import {RARITIES} from './rarity';
import {RaritySymbol} from './RaritySymbol';

interface RarityBreakdownProps {
  /** Revealed count per rarity key (from useRevealProgress). */
  rarityCounts: Record<string, number>;
  /** Mobile sizing: fixed 3 columns / smaller gems. */
  compact?: boolean;
}

/**
 * Per-rarity tally for an ink board: each of the five rarities shows its real
 * symbol, a `revealed/total` count, and its name. The numerator is capped at the
 * per-color total so a dual-ink spillover never renders as e.g. "4/3" — the
 * extra card still occupies a mosaic slot, but the fraction stays truthful to
 * the official 34-card composition.
 *
 * The divider spans the full board, but the five items are held to a centered
 * band so they read as a tidy row (the prototype's grid stretched 6 items full
 * width; with 5 that left them too far apart).
 */
export function RarityBreakdown({rarityCounts, compact = false}: RarityBreakdownProps) {
  return (
    <div style={{borderTop: '1px solid #22223a', marginTop: 22, paddingTop: 12}}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: compact ? 'repeat(3, 1fr)' : 'repeat(auto-fit, minmax(96px, 1fr))',
          gap: compact ? 2 : 4,
          maxWidth: compact ? undefined : 900,
          margin: compact ? undefined : '0 auto',
        }}
      >
        {RARITIES.map((r) => {
          const revealed = Math.min(rarityCounts[r.key] ?? 0, r.total);
          const has = revealed > 0;
          return (
            <div key={r.key} style={{display: 'flex', alignItems: 'center', gap: 9, padding: '8px 6px'}}>
              <div style={{width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto'}}>
                <RaritySymbol rarity={r.key} size={compact ? 15 : 18} />
              </div>
              <div>
                <div style={{fontWeight: 700, fontSize: 15, color: has ? '#e8e8e8' : '#4a4a60', lineHeight: 1}}>
                  {revealed}
                  <span style={{fontSize: 11, fontWeight: 600, color: '#54546e'}}>/{r.total}</span>
                </div>
                <div
                  style={{
                    fontWeight: 500,
                    fontSize: 9.5,
                    letterSpacing: 0.6,
                    textTransform: 'uppercase',
                    color: '#7a7a92',
                    marginTop: 3,
                  }}
                >
                  {r.name}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
