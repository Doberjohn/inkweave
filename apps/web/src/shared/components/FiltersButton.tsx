import {FilterIcon} from './FilterIcon';
import {CountBadge} from './CountBadge';
import {ToolbarToggle} from './ToolbarToggle';

interface FiltersButtonProps {
  onClick: () => void;
  activeCount: number;
  isMobile?: boolean;
  /**
   * Set when the button toggles Browse's docked panel rather than opening the
   * dialog: whether that panel is open. Left undefined for a dialog trigger.
   */
  expanded?: boolean;
  /**
   * The filled look; the ghost outline while false. Browse's docked panel shows it while
   * open (owner, 2026-10-08). A dialog trigger stays filled: its dialog covers it.
   */
  active?: boolean;
}

/**
 * The toolbar "Filters" button (#509): a ToolbarToggle, the toolbar's filled-or-ghost
 * recipe it shares with Browse's Collection button.
 */
export function FiltersButton({onClick, activeCount, isMobile, expanded, active = true}: FiltersButtonProps) {
  return (
    <ToolbarToggle
      active={active}
      isMobile={isMobile}
      onClick={onClick}
      aria-label="Filters"
      aria-expanded={expanded}>
      <FilterIcon />
      Filters
      <CountBadge count={activeCount} />
    </ToolbarToggle>
  );
}
