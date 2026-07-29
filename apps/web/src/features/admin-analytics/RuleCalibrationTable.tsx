import {useState} from 'react';
import {CAP_LABEL_XS, COLORS, FONT_SIZES, FONTS, LETTER_SPACING, RADIUS, SPACING, TABULAR} from '../../shared/constants';
import type {RuleStat} from './voteAnalyticsTypes';

interface RuleCalibrationTableProps {
  rules: RuleStat[];
  selectedRuleId: string | null;
  onSelectRule: (ruleId: string) => void;
}

/** Below this many score votes a rule's number is statistically thin. */
const LOW_N = 10;
/** A gap this far from zero fills the whole half-track. */
const GAP_FULL_SCALE = 2.5;

type SortKey = 'gap' | 'votes';

/** Signed gap value, colored + tabular. */
function gapColor(meanGap: number | null): string {
  if (meanGap == null) return COLORS.textMuted;
  if (meanGap < 0) return COLORS.error;
  if (meanGap > 0) return COLORS.success;
  return COLORS.textMuted;
}

function formatGap(meanGap: number | null): string {
  if (meanGap == null) return '—';
  return (meanGap > 0 ? '+' : '') + meanGap.toFixed(2);
}

/** The diverging gap bar: a center-ticked track with a fill leaning left (over) or right (under). */
function GapBar({meanGap}: {meanGap: number | null}) {
  const magnitude = meanGap == null ? 0 : Math.min(Math.abs(meanGap) / GAP_FULL_SCALE, 1) * 50;
  const overRates = meanGap != null && meanGap < 0;
  return (
    <div style={{position: 'relative', height: 6, background: COLORS.surface, borderRadius: RADIUS.xs, minWidth: 80}}>
      <div style={{position: 'absolute', left: '50%', top: -2, width: 1, height: 10, background: COLORS.textDim}} />
      {meanGap != null && meanGap !== 0 && (
        <div
          style={{
            position: 'absolute',
            top: 0,
            height: 6,
            width: `${magnitude}%`,
            borderRadius: RADIUS.xs,
            background: overRates ? COLORS.error : COLORS.success,
            ...(overRates ? {right: '50%'} : {left: '50%'}),
          }}
        />
      )}
    </div>
  );
}

const HEADER_CELL: React.CSSProperties = {
  ...CAP_LABEL_XS,
  textAlign: 'left',
  padding: `${SPACING.sm}px ${SPACING.md}px`,
};

/** Header button for a sortable column; shows the active-sort caret. */
function SortHeader({
  label,
  active,
  onClick,
  align,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
  align: 'left' | 'right';
}) {
  return (
    <th style={{...HEADER_CELL, textAlign: align}}>
      <button
        type="button"
        onClick={onClick}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          cursor: 'pointer',
          font: 'inherit',
          textTransform: 'uppercase',
          letterSpacing: LETTER_SPACING.cap,
          color: active ? COLORS.primary : COLORS.textMuted,
        }}>
        {label}
        {active ? ' ▼' : ''}
      </button>
    </th>
  );
}

const CELL: React.CSSProperties = {padding: `${SPACING.sm}px ${SPACING.md}px`, verticalAlign: 'middle'};

const NUMERIC_CELL: React.CSSProperties = {
  ...CELL,
  textAlign: 'right',
  ...TABULAR,
  fontSize: FONT_SIZES.base,
};

const LOW_N_CHIP: React.CSSProperties = {
  fontSize: FONT_SIZES.xs,
  color: COLORS.textDim,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.xs,
  padding: '0 4px',
  marginLeft: 6,
  verticalAlign: 'middle',
};

/** One selectable rule row; owns its own hover state so the table stays a thin shell. */
function RuleRow({rule, selected, onSelect}: {rule: RuleStat; selected: boolean; onSelect: (ruleId: string) => void}) {
  const [hovered, setHovered] = useState(false);
  const select = () => onSelect(rule.ruleId);
  return (
    <tr
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={select}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          select();
        }
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      style={{
        borderBottom: `1px solid ${COLORS.surfaceBorder}`,
        background: selected || hovered ? COLORS.surfaceHover : 'transparent',
        boxShadow: selected ? `inset 2px 0 0 ${COLORS.primary}` : 'none',
        opacity: rule.scoreVotes === 0 ? 0.5 : 1,
        cursor: 'pointer',
      }}>
      <td style={{...CELL, fontSize: FONT_SIZES.base, color: COLORS.text}}>
        {rule.ruleName}
        {rule.scoreVotes < LOW_N && <span style={LOW_N_CHIP}>low n</span>}
      </td>
      <td style={{...CELL, width: '35%'}}>
        <GapBar meanGap={rule.meanGap} />
      </td>
      <td style={{...NUMERIC_CELL, color: gapColor(rule.meanGap)}}>{formatGap(rule.meanGap)}</td>
      <td style={{...NUMERIC_CELL, color: COLORS.textMuted}}>{rule.scoreVotes.toLocaleString()}</td>
    </tr>
  );
}

/**
 * Sortable, selectable rule-calibration table. Each RuleRow is a focusable
 * element (click or Enter/Space selects the rule); the selected row gets a gold
 * inset border. Sorted by |meanGap| descending; clicking the Gap or Votes
 * header switches which column drives that descending sort.
 */
export function RuleCalibrationTable({rules, selectedRuleId, onSelectRule}: RuleCalibrationTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('gap');

  // No useMemo: the React Compiler memoizes; sorted feeds render only.
  const rank = (r: RuleStat) => (sortKey === 'gap' ? Math.abs(r.meanGap ?? 0) : r.scoreVotes);
  const sorted = [...rules].sort((a, b) => rank(b) - rank(a));

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontFamily: FONTS.body,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
      }}>
      <thead>
        <tr style={{borderBottom: `1px solid ${COLORS.surfaceBorder}`}}>
          <th style={HEADER_CELL}>Rule</th>
          <th style={HEADER_CELL}>Bias</th>
          <SortHeader label="Gap" active={sortKey === 'gap'} onClick={() => setSortKey('gap')} align="right" />
          <SortHeader label="Votes" active={sortKey === 'votes'} onClick={() => setSortKey('votes')} align="right" />
        </tr>
      </thead>
      <tbody>
        {sorted.map((rule) => (
          <RuleRow
            key={rule.ruleId}
            rule={rule}
            selected={rule.ruleId === selectedRuleId}
            onSelect={onSelectRule}
          />
        ))}
      </tbody>
    </table>
  );
}
