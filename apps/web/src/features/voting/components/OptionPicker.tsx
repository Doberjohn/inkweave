import {COLORS, FONTS} from '../../../shared/constants';

export interface OptionPickerOption<T> {
  key: string;
  label: string;
  value: T;
}

interface OptionPickerProps<T> {
  ariaLabel: string;
  options: OptionPickerOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  isMobile?: boolean;
}

/**
 * Generic 2-3 option radio group, styled consistently with CarriesPicker.
 * Used for IsReal, Accuracy, WouldPlay, and Difficulty dimensions.
 */
export function OptionPicker<T>({ariaLabel, options, value, onChange, isMobile}: OptionPickerProps<T>) {
  const height = isMobile ? 40 : 48;

  if (isMobile) {
    return (
      <div role="radiogroup" aria-label={ariaLabel} style={{display: 'flex', flexDirection: 'column', gap: 6, width: '100%'}}>
        {options.map(({key, label, value: optValue}) => {
          const isSelected = value === optValue;
          return (
            <button
              key={key}
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(optValue)}
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
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        width: '100%',
        borderRadius: 8,
        border: '1px solid #333355',
        overflow: 'hidden',
      }}>
      {options.map(({key, label, value: optValue}, i) => {
        const isSelected = value === optValue;
        return (
          <button
            key={key}
            role="radio"
            aria-checked={isSelected}
            onClick={() => onChange(optValue)}
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
