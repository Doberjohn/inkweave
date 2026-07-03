import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import type {PairStat} from './voteAnalyticsTypes';

interface PairListProps {
  pairs: PairStat[];
  selectedPair: {a: string; b: string} | null;
  onSelectPair: (p: {a: string; b: string}) => void;
}

const truncate: React.CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * A clickable list of voted pairs (already filtered + sorted by the parent).
 * Each row shows the two card names, the engine→community score jump, and the
 * vote count; the selected row is highlighted. A caption reminds the reader
 * that most pairs carry a single vote, so the rule-level trend is what to trust.
 */
export function PairList({pairs, selectedPair, onSelectPair}: PairListProps) {
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div style={{fontFamily: FONTS.body}}>
      <div
        style={{
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.lg,
          background: COLORS.surface,
          overflow: 'hidden',
        }}>
        {pairs.map((pair, i) => {
          const key = `${pair.a}|${pair.b}`;
          const selected = selectedPair?.a === pair.a && selectedPair?.b === pair.b;
          const highlighted = selected || hovered === key;
          const isLast = i === pairs.length - 1;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={selected}
              onClick={() => onSelectPair({a: pair.a, b: pair.b})}
              onMouseEnter={() => setHovered(key)}
              onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
              onFocus={() => setHovered(key)}
              onBlur={() => setHovered((h) => (h === key ? null : h))}
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto',
                alignItems: 'center',
                gap: SPACING.md,
                width: '100%',
                textAlign: 'left',
                background: highlighted ? COLORS.surfaceHover : 'transparent',
                border: 'none',
                borderBottom: isLast ? 'none' : `1px solid ${COLORS.surfaceBorder}`,
                cursor: 'pointer',
                font: 'inherit',
                color: COLORS.text,
                padding: `${SPACING.sm}px ${SPACING.md}px`,
              }}>
              <span style={{...truncate, fontSize: FONT_SIZES.base}}>
                {pair.aName}
                <span style={{color: COLORS.textDim}}> × </span>
                {pair.bName}
              </span>
              <span style={{fontSize: FONT_SIZES.md, color: COLORS.error, fontVariantNumeric: 'tabular-nums'}}>
                {pair.engineScore} → {pair.communityScore}
              </span>
              <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim, fontVariantNumeric: 'tabular-nums'}}>
                {pair.scoreVotes}
              </span>
            </button>
          );
        })}
      </div>
      <div style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim, marginTop: SPACING.sm}}>
        Most pairs have a single vote — trust the rule-level trend over any one row.
      </div>
    </div>
  );
}
