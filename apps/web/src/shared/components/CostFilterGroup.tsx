import {COST_BUTTONS, COLORS} from '../constants';
import {FilterButton} from './FilterButton';
import {CostIcon} from './CostIcon';

interface CostFilterGroupProps {
  costFilters: number[];
  onToggleCost: (cost: number) => void;
  iconSize?: number;
  style?: React.CSSProperties;
}

/** Inline ink cost filter icons with gold glow, matching InkFilterGroup pattern. */
export function CostFilterGroup({
  costFilters,
  onToggleCost,
  iconSize = 28,
  style,
}: CostFilterGroupProps) {
  return (
    <div role="group" aria-label="Ink cost filters" style={{display: 'flex', gap: 4, ...style}}>
      {COST_BUTTONS.map((cost) => (
        <FilterButton
          key={cost}
          size="sm"
          active={costFilters.includes(cost)}
          onClick={() => onToggleCost(cost)}
          activeColor={COLORS.primary}
          activeBgColor={COLORS.primary200}
          inactiveColor="transparent"
          inactiveTextColor="transparent"
          aria-label={`Cost ${cost}${cost >= 9 ? '+' : ''}`}>
          <CostIcon cost={cost} size={iconSize} />
        </FilterButton>
      ))}
    </div>
  );
}
