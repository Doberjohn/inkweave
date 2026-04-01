import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, FONTS} from '../../../shared/constants';

type CarriesValue = 'a' | 'b' | 'both';

interface CarriesPickerProps {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  value: CarriesValue | null;
  onChange: (value: CarriesValue) => void;
  isMobile?: boolean;
}

export function CarriesPicker({cardA, cardB, value, onChange, isMobile}: CarriesPickerProps) {
  const options: {key: CarriesValue; label: string}[] = [
    {key: 'a', label: cardA.fullName},
    {key: 'both', label: 'Both equally'},
    {key: 'b', label: cardB.fullName},
  ];

  const height = isMobile ? 40 : 48;

  if (isMobile) {
    return (
      <div role="radiogroup" aria-label="Which card carries this synergy" style={{display: 'flex', flexDirection: 'column', gap: 6, width: '100%'}}>
        {options.map(({key, label}) => {
          const isSelected = value === key;
          return (
            <button
              key={key}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(key)}
              style={{
                width: '100%',
                height,
                borderRadius: 8,
                border: isSelected ? 'none' : '1px solid #333355',
                background: isSelected ? COLORS.primary : '#0d0d14',
                color: isSelected ? '#0d0d14' : '#90a1b9',
                fontSize: 13,
                fontWeight: isSelected ? 600 : 500,
                fontFamily: FONTS.body,
                cursor: 'pointer',
                padding: 0,
              }}>
              {label}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Which card carries this synergy"
      style={{
        display: 'flex',
        width: '100%',
        borderRadius: 8,
        border: '1px solid #333355',
        overflow: 'hidden',
      }}>
      {options.map(({key, label}, i) => {
        const isSelected = value === key;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(key)}
            style={{
              flex: 1,
              minWidth: 0,
              height,
              border: 'none',
              borderLeft: i > 0 ? '1px solid #333355' : 'none',
              background: isSelected ? COLORS.primary : '#0d0d14',
              color: isSelected ? '#0d0d14' : '#90a1b9',
              fontSize: 13,
              fontWeight: isSelected ? 600 : 500,
              fontFamily: FONTS.body,
              cursor: 'pointer',
              padding: '0 12px',
            }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
