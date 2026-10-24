import {COST_BUTTONS, COLORS, SPACING} from '../constants';
import {FilterButton} from './FilterButton';
import {CostIcon} from './CostIcon';

interface CostFilterGroupProps {
  costFilters: number[];
  onToggleCost: (cost: number) => void;
  /**
   * The costs that can be picked (e.g. only those a playstyle's cards have). The rest show
   * dimmed and off, holding their places. Defaults to 1 through 9+.
   */
  offered?: readonly number[];
  iconSize?: number;
  style?: React.CSSProperties;
  /** Draw the icons in the uninkable cost hexagon, while the Uninkable filter is on. */
  uninkable?: boolean;
}

/** Inline ink cost filter icons with gold glow, matching InkFilterGroup pattern. */
export function CostFilterGroup({
  costFilters,
  onToggleCost,
  offered = COST_BUTTONS,
  iconSize = 28,
  style,
  uninkable = false,
}: CostFilterGroupProps) {
  return (
    <div
      role="group"
      aria-label="Ink cost filters"
      style={{display: 'flex', gap: SPACING.xs, ...style}}>
      {COST_BUTTONS.map((cost) => (
        <FilterButton
          key={cost}
          size="sm"
          active={costFilters.includes(cost)}
          onClick={() => onToggleCost(cost)}
          disabled={!offered.includes(cost)}
          activeColor={COLORS.primary}
          activeBgColor={COLORS.primary200}
          inactiveColor="transparent"
          inactiveTextColor="transparent"
          aria-label={`Cost ${cost}${cost >= 9 ? '+' : ''}`}>
          <CostIcon cost={cost} size={iconSize} inkwell={uninkable ? 'uninkable' : 'inkable'} />
        </FilterButton>
      ))}
    </div>
  );
}
