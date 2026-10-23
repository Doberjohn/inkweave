import type {InkwellValue} from './InkwellIcon';
import {FilterButton} from './FilterButton';
import {InkwellIcon} from './InkwellIcon';
import {COLORS} from '../constants';

const INKWELL_OPTIONS: {value: InkwellValue; label: string}[] = [
  {value: 'inkable', label: 'Inkable'},
  {value: 'uninkable', label: 'Uninkable'},
];

const ALL_INKWELL_VALUES = INKWELL_OPTIONS.map((option) => option.value);

interface InkwellFilterGroupProps {
  activeValue: InkwellValue | undefined;
  onToggle: (value: InkwellValue | undefined) => void;
  /**
   * The values that can be picked (e.g. only those a playstyle's cards have). The rest show
   * dimmed and off, holding their places. Defaults to both.
   */
  offered?: readonly InkwellValue[];
  size?: 'sm' | 'md';
  iconSize?: number;
  style?: React.CSSProperties;
}

/** Inkable / Uninkable toggle filter icons with gold glow. */
export function InkwellFilterGroup({
  activeValue,
  onToggle,
  offered = ALL_INKWELL_VALUES,
  size = 'sm',
  iconSize = 28,
  style,
}: InkwellFilterGroupProps) {
  const handleClick = (value: InkwellValue) => {
    onToggle(activeValue === value ? undefined : value);
  };

  return (
    <div role="group" aria-label="Inkwell filters" style={{display: 'flex', gap: 4, ...style}}>
      {INKWELL_OPTIONS.map(({value, label}) => (
        <FilterButton
          key={value}
          size={size}
          active={activeValue === value}
          onClick={() => handleClick(value)}
          disabled={!offered.includes(value)}
          activeColor={COLORS.primary500}
          activeBgColor={COLORS.primary200}
          inactiveColor="transparent"
          inactiveTextColor="transparent"
          aria-label={`Filter by ${label}`}>
          <InkwellIcon value={value} size={iconSize} decorative={false} />
        </FilterButton>
      ))}
    </div>
  );
}
