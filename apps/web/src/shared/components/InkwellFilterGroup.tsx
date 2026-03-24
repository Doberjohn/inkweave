import type {InkwellValue} from './InkwellIcon';
import {FilterButton} from './FilterButton';
import {InkwellIcon} from './InkwellIcon';
import {COLORS} from '../constants';

const INKWELL_OPTIONS: {value: InkwellValue; label: string}[] = [
  {value: 'inkable', label: 'Inkable'},
  {value: 'uninkable', label: 'Uninkable'},
];

interface InkwellFilterGroupProps {
  activeValue: InkwellValue | undefined;
  onToggle: (value: InkwellValue | undefined) => void;
  size?: 'sm' | 'md';
  iconSize?: number;
  style?: React.CSSProperties;
}

/** Inkable / Uninkable toggle filter icons with gold glow. */
export function InkwellFilterGroup({
  activeValue,
  onToggle,
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
