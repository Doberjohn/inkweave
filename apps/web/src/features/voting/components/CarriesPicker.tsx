import type {LorcanaCard} from 'inkweave-synergy-engine';
import {OptionPicker, type OptionPickerOption} from './OptionPicker';

type CarriesValue = 'a' | 'b' | 'both';

interface CarriesPickerProps {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  value: CarriesValue | null;
  onChange: (value: CarriesValue) => void;
  isMobile?: boolean;
}

/**
 * "Which card carries this synergy" radio row: a thin adapter over the shared
 * OptionPicker in its default gold scheme (#509 folded a wholesale duplicate).
 */
export function CarriesPicker({cardA, cardB, value, onChange, isMobile}: CarriesPickerProps) {
  const options: OptionPickerOption<CarriesValue>[] = [
    {key: 'a', label: cardA.fullName, value: 'a'},
    {key: 'both', label: 'Both equally', value: 'both'},
    {key: 'b', label: cardB.fullName, value: 'b'},
  ];

  return (
    <OptionPicker
      ariaLabel="Which card carries this synergy"
      options={options}
      value={value}
      onChange={onChange}
      isMobile={isMobile}
    />
  );
}
