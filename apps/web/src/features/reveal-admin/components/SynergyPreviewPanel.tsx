import type {SynergyGroup} from 'inkweave-synergy-engine';
import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';

interface SynergyPreviewPanelProps {
  groups: SynergyGroup[];
}

export function SynergyPreviewPanel({groups}: SynergyPreviewPanelProps) {
  if (groups.length === 0) {
    return (
      <div style={{color: COLORS.gray600, fontSize: FONT_SIZES.sm}}>
        No synergies detected yet. Add card text or keywords to see matches.
      </div>
    );
  }
  return (
    <ul style={{listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: SPACING.xs}}>
      {groups.map((g) => (
        <li
          key={g.groupKey}
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: SPACING.sm,
            padding: `${SPACING.xs}px ${SPACING.sm}px`,
            background: COLORS.surfaceAlt,
            borderRadius: RADIUS.sm,
            color: COLORS.text,
            fontSize: FONT_SIZES.sm,
          }}>
          <span>{g.label}</span>
          <span style={{color: COLORS.gray600}}>{g.synergies.length} card(s)</span>
        </li>
      ))}
    </ul>
  );
}
