import type {Ink} from 'inkweave-synergy-engine';
import {ALL_INKS, INK_COLORS} from '../constants';
import {FilterButton} from './FilterButton';
import {InkIcon} from './InkIcon';

type FilterButtonSize = 'sm' | 'md';

interface InkFilterGroupProps {
  inkFilters: Ink[];
  onToggleInk: (ink: Ink) => void;
  /** The inks to offer (e.g. only those a playstyle's cards use). Defaults to all six. */
  inks?: readonly Ink[];
  /**
   * The inks that can be picked: the rest of `inks` show dimmed and off, holding their
   * places (a playstyle's toolbar). Defaults to every ink shown.
   */
  offered?: readonly Ink[];
  size?: FilterButtonSize;
  iconSize?: number;
  style?: React.CSSProperties;
}

/** Reusable ink color filter icons with colored hover glow. */
export function InkFilterGroup({
  inkFilters,
  onToggleInk,
  inks = ALL_INKS,
  offered = inks,
  size = 'sm',
  iconSize = 28,
  style,
}: InkFilterGroupProps) {
  return (
    <div role="group" aria-label="Ink color filters" style={{display: 'flex', gap: 4, ...style}}>
      {inks.map((ink) => (
        <FilterButton
          key={ink}
          size={size}
          active={inkFilters.includes(ink)}
          onClick={() => onToggleInk(ink)}
          disabled={!offered.includes(ink)}
          activeColor={INK_COLORS[ink].border}
          activeBgColor={INK_COLORS[ink].bg}
          inactiveColor="transparent"
          inactiveTextColor="transparent"
          aria-label={`Filter by ${ink}`}>
          <InkIcon ink={ink} size={iconSize} decorative={false} />
        </FilterButton>
      ))}
    </div>
  );
}
