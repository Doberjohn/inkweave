import {useState} from 'react';
import type {CSSProperties} from 'react';
import {COLORS, FONT_SIZES, FONTS, SPACING, TABULAR} from '../../../shared/constants';
import {CtaButton, DialogShell} from '../../../shared/components';
import type {HealthAnalyzer, ScoreContribution} from '../types';
import {dimensionColor} from './dimensionColor';
import {orderAnalyzers} from './HealthGrid';

/** The subtractive vulnerability-penalty row id — always rendered last, below a divider. */
const PENALTY_ID = 'vulnerability-penalty';

/** Labels for breakdown entries that have no matching analyzer (defensive fallback). */
const DIMENSION_LABELS: Record<string, string> = {
  [PENALTY_ID]: 'Vulnerabilities',
};

/** Label for an unmatched dimension id, title-casing defensively (no build break). */
function labelFor(dimension: string): string {
  return (
    DIMENSION_LABELS[dimension] ??
    dimension
      .replace(/([A-Z])/g, ' $1')
      .replace(/[-_]/g, ' ')
      .replace(/^./, (c) => c.toUpperCase())
      .trim()
  );
}

const signed = (n: number): string => (n >= 0 ? `+${Math.round(n)}` : `${Math.round(n)}`);

const rowButton: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.md,
  width: '100%',
  padding: '7px 0',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
};

const pointsCell = (negative: boolean): CSSProperties => ({
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.base}px`,
  fontWeight: 700,
  width: 34,
  textAlign: 'right',
  ...TABULAR,
  color: negative ? COLORS.error : COLORS.textMuted,
  flexShrink: 0,
});

const detailText: CSSProperties = {
  fontFamily: FONTS.body,
  fontSize: `${FONT_SIZES.sm}px`,
  lineHeight: 1.5,
  color: COLORS.textMuted,
  padding: `0 0 ${SPACING.sm}px 21px`,
};

/** One dimension row: status dot, label, health score, signed points; verdict + weight when open. */
function AnalyzerRow({
  analyzer,
  points,
  isOpen,
  onToggle,
}: {
  analyzer: HealthAnalyzer;
  points: ScoreContribution | undefined;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div style={{borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} style={rowButton}>
        <span
          aria-hidden
          style={{width: 9, height: 9, borderRadius: '50%', background: dimensionColor(analyzer.status), flexShrink: 0}}
        />
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, fontWeight: isOpen ? 700 : 400, color: COLORS.text}}>
          {analyzer.label}
        </span>
        <span style={{flex: 1}} />
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textDim, ...TABULAR}}>
          {analyzer.score}
        </span>
        {points && <span style={pointsCell(points.contribution < 0)}>{signed(points.contribution)}</span>}
      </button>
      {isOpen && (
        <div style={detailText}>
          {analyzer.message}
          {points && (
            <span style={{color: COLORS.textDim}}>
              {' '}
              · Weight {Number(points.weight.toFixed(2))}, hitting {Math.round(points.dimensionScore * 100)}% of target
              {/* score.ts sets reason = analyzer.message, so only append when it truly adds something */}
              {points.reason && points.reason !== analyzer.message ? ` · ${points.reason}` : ''}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

/** A breakdown term with no matching analyzer (e.g. a future coherence term): plain row. */
function LeftoverRow({term}: {term: ScoreContribution}) {
  return (
    <div style={{...rowButton, cursor: 'default', borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
      <span aria-hidden style={{width: 9, height: 9, borderRadius: '50%', background: COLORS.textDim, flexShrink: 0}} />
      <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, color: COLORS.text}}>{labelFor(term.dimension)}</span>
      <span style={{flex: 1}} />
      <span style={pointsCell(term.contribution < 0)}>{signed(term.contribution)}</span>
    </div>
  );
}

/** The subtractive vulnerability penalty, last, with its reason always visible. */
function PenaltyRow({penalty}: {penalty: ScoreContribution}) {
  return (
    <div style={{paddingTop: 2}}>
      <div style={{...rowButton, cursor: 'default'}}>
        <span aria-hidden style={{width: 9, height: 9, borderRadius: '50%', background: COLORS.error, flexShrink: 0}} />
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.base}px`, fontWeight: 700, color: COLORS.text}}>
          {labelFor(PENALTY_ID)}
        </span>
        <span style={{flex: 1}} />
        <span style={pointsCell(penalty.contribution < 0)}>{signed(penalty.contribution)}</span>
      </div>
      <div style={detailText}>{penalty.reason}</div>
    </div>
  );
}

interface ScoreMathModalProps {
  score: number;
  configVersion: string;
  analyzers: HealthAnalyzer[];
  breakdown: ScoreContribution[];
  onClose: () => void;
}

/**
 * The glass-box score math as a modal (#472): one row per dimension (status dot,
 * label, health score, signed points), status-grouped with problems pre-expanded
 * so they self-explain; any row toggles its verdict + weight math. Rides the
 * DialogShell overlay contract (#510): token scrim (no backdrop-filter, a
 * WebKit E2E repaint trap), focus trap, scroll lock, and Escape / backdrop /
 * Close all dismiss.
 */
export function ScoreMathModal({score, configVersion, analyzers, breakdown, onClose}: ScoreMathModalProps) {
  const ordered = orderAnalyzers(analyzers);
  const [open, setOpen] = useState<Set<string>>(
    () => new Set(ordered.filter((a) => a.status === 'bad').map((a) => a.id)),
  );

  const toggle = (id: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const byDimension = new Map(breakdown.map((b) => [b.dimension, b]));
  const penalty = byDimension.get(PENALTY_ID);
  const matched = new Set(ordered.map((a) => a.id));
  // Defensive: breakdown terms with no analyzer (e.g. a future coherence term)
  // still render as plain rows instead of silently vanishing from the math.
  const leftovers = breakdown.filter((b) => b.dimension !== PENALTY_ID && !matched.has(b.dimension));

  return (
    <DialogShell
      isOpen
      onClose={onClose}
      ariaLabel={`Score math for ${score}`}
      size="md"
      panelStyle={{display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: SPACING.xl, fontFamily: FONTS.body}}>
      <h2 style={{fontFamily: FONTS.hero, fontSize: FONT_SIZES.xxl, color: COLORS.text, margin: 0}}>Why {score}?</h2>
      <p style={{fontSize: `${FONT_SIZES.sm}px`, color: COLORS.textDim, margin: `${SPACING.xs}px 0 ${SPACING.md}px`}}>
        Every dimension's points, weighted and summed. Tap a row for its verdict and weight.
      </p>

      <div style={{overflowY: 'auto', flex: 1, minHeight: 0}}>
        {ordered.map((a) => (
          <AnalyzerRow
            key={a.id}
            analyzer={a}
            points={byDimension.get(a.id)}
            isOpen={open.has(a.id)}
            onToggle={() => toggle(a.id)}
          />
        ))}
        {leftovers.map((b) => (
          <LeftoverRow key={b.dimension} term={b} />
        ))}
        {penalty && <PenaltyRow penalty={penalty} />}
      </div>

      <p style={{fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim, margin: `${SPACING.md}px 0 0`}}>
        Inkweave Engine Score · config {configVersion} · transparent weighted formula
      </p>
      <CtaButton variant="neutral" onClick={onClose} style={{marginTop: SPACING.md, width: '100%'}}>
        Close
      </CtaButton>
    </DialogShell>
  );
}
