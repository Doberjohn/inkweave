import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import type {VoteLogRow} from './voteLogTypes';

interface VoteDetailTableProps {
  pair: {aName: string; bName: string; engineScore: number} | null;
  votes: VoteLogRow[];
}

/** High scores read green, low scores red; middling scores stay neutral. */
function scoreColor(score: number | null): string {
  if (score == null) return COLORS.textMuted;
  if (score >= 7) return COLORS.success;
  if (score <= 4) return COLORS.error;
  return COLORS.text;
}

/** Map the accuracy thumb (-1 / 0 / 1 / null) to its label. */
function accuracyLabel(accuracy: number | null): string {
  if (accuracy === -1) return 'too high';
  if (accuracy === 0) return 'right';
  if (accuracy === 1) return 'too low';
  return '—';
}

function wouldPlayLabel(wouldPlay: boolean | null): string {
  if (wouldPlay == null) return '—';
  return wouldPlay ? 'yes' : 'no';
}

const HEAD: React.CSSProperties = {
  fontSize: FONT_SIZES.xs,
  color: COLORS.textMuted,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  textAlign: 'left',
  padding: `${SPACING.sm}px ${SPACING.md}px`,
};

/**
 * The per-pair vote breakdown. With no pair selected it renders a muted empty
 * state; otherwise a heading (names + engine score) and a table of each vote's
 * score, accuracy thumb, would-play flag, and date.
 */
export function VoteDetailTable({pair, votes}: VoteDetailTableProps) {
  if (pair == null) {
    return (
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: FONT_SIZES.base,
          color: COLORS.textMuted,
          padding: SPACING.lg,
          textAlign: 'center',
          border: `1px dashed ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.lg,
        }}>
        Select a pair to see its votes
      </div>
    );
  }

  const cell: React.CSSProperties = {
    padding: `${SPACING.sm}px ${SPACING.md}px`,
    fontSize: FONT_SIZES.base,
    color: COLORS.text,
  };

  return (
    <div style={{fontFamily: FONTS.body}}>
      <div style={{fontSize: FONT_SIZES.lg, fontWeight: 700, color: COLORS.text, marginBottom: SPACING.sm}}>
        {pair.aName} <span style={{color: COLORS.textDim}}>×</span> {pair.bName}
        <span style={{fontSize: FONT_SIZES.md, color: COLORS.textMuted, fontWeight: 400, marginLeft: SPACING.sm}}>
          engine {pair.engineScore}
        </span>
      </div>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          background: COLORS.surface,
          border: `1px solid ${COLORS.surfaceBorder}`,
          borderRadius: RADIUS.lg,
        }}>
        <thead>
          <tr style={{borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
            <th style={HEAD}>Score</th>
            <th style={HEAD}>Accuracy</th>
            <th style={HEAD}>Would play</th>
            <th style={HEAD}>When</th>
          </tr>
        </thead>
        <tbody>
          {votes.map((vote, i) => (
            <tr key={`${vote.voter}-${vote.ts}-${i}`} style={{borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
              <td style={{...cell, fontWeight: 700, color: scoreColor(vote.score)}}>
                {vote.score == null ? '—' : vote.score}
              </td>
              <td style={{...cell, color: COLORS.textMuted}}>{accuracyLabel(vote.accuracy)}</td>
              <td style={{...cell, color: COLORS.textMuted}}>{wouldPlayLabel(vote.wouldPlay)}</td>
              <td style={{...cell, color: COLORS.textDim, fontVariantNumeric: 'tabular-nums'}}>{vote.ts.slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
