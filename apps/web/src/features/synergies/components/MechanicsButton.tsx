import {GOLD_GLOW} from '../../../shared/constants';
import {CountBadge} from '../../../shared/components/CountBadge';
import {ToolbarToggle} from '../../../shared/components/ToolbarToggle';

interface MechanicsButtonProps {
  onClick: () => void;
  activeCount: number;
  isMobile?: boolean;
  /** Off while the playstyle's cards load: the button holds its place in the toolbar (#914). */
  disabled?: boolean;
}

function MechanicsIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg">
      {/* Three small "tile" squares — visually distinct from FilterIcon's funnel */}
      <rect x="2" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="2" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="2" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
      <rect x="12" y="12" width="6" height="6" rx="1.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

/** With mechanics chosen, the outline fills with the gold selection tint and glow. */
const CHOSEN_STYLE: React.CSSProperties = {
  background: GOLD_GLOW.activeBg,
  boxShadow: GOLD_GLOW.shadow,
};

/**
 * The phone toolbar's "Mechanics" button, which opens the mechanics sheet: a ToolbarToggle in its
 * ghost outline beside the filled Filters button. Chosen mechanics fill it with the gold
 * selection tint and glow, and its count badge says how many.
 */
export function MechanicsButton({onClick, activeCount, isMobile, disabled}: MechanicsButtonProps) {
  return (
    <ToolbarToggle
      active={false}
      isMobile={isMobile}
      onClick={onClick}
      disabled={disabled}
      aria-label="Mechanics"
      style={activeCount > 0 ? CHOSEN_STYLE : undefined}>
      <MechanicsIcon />
      Mechanics
      <CountBadge count={activeCount} />
    </ToolbarToggle>
  );
}
