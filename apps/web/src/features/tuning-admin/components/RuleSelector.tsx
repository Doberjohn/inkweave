import {TUNING} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';

interface RuleSelectorProps {
  selectedId: string | null;
  onSelect: (id: string) => void;
}

const groupLabelStyle = {
  fontSize: FONT_SIZES.xs,
  color: COLORS.gray600,
  textTransform: 'uppercase' as const,
  letterSpacing: 0.5,
  margin: `${SPACING.md}px 0 ${SPACING.xs}px`,
};

function itemStyle(active: boolean) {
  return {
    display: 'block',
    width: '100%',
    textAlign: 'left' as const,
    padding: '8px 10px',
    marginBottom: 4,
    background: active ? COLORS.primary100 : COLORS.surfaceAlt,
    color: active ? COLORS.primary : COLORS.text,
    border: `1px solid ${active ? COLORS.primary : COLORS.surfaceHover}`,
    borderRadius: RADIUS.sm,
    fontSize: FONT_SIZES.sm,
    cursor: 'pointer',
  };
}

/** Two-group picker (playstyles + direct synergies) that drives the editor. */
export function RuleSelector({selectedId, onSelect}: RuleSelectorProps) {
  return (
    <nav aria-label="Tuning rules">
      <div style={groupLabelStyle}>Playstyles</div>
      {Object.keys(TUNING.playstyles).map((id) => (
        <button key={id} style={itemStyle(id === selectedId)} onClick={() => onSelect(id)}>
          {TUNING.playstyles[id].name}
        </button>
      ))}
      <div style={groupLabelStyle}>Direct synergies</div>
      {Object.keys(TUNING.directRules).map((id) => (
        <button key={id} style={itemStyle(id === selectedId)} onClick={() => onSelect(id)}>
          {TUNING.directRules[id].name}
        </button>
      ))}
    </nav>
  );
}
