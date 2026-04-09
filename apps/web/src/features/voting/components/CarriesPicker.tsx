import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {COLORS, EASING, FONTS, RADIUS, SPACING} from '../../../shared/constants';

type CarriesValue = 'a' | 'b' | 'both';

interface CarriesPickerProps {
  cardA: LorcanaCard;
  cardB: LorcanaCard;
  value: CarriesValue | null;
  onChange: (value: CarriesValue) => void;
  isMobile?: boolean;
}

const CARRIES_COLOR = {
  border: COLORS.primary,
  glow: 'rgba(255, 185, 0, 0.15)',
  hintBg: 'rgba(255, 185, 0, 0.06)',
  hoverBorder: 'rgba(255, 185, 0, 0.35)',
};

export function CarriesPicker({cardA, cardB, value, onChange, isMobile}: CarriesPickerProps) {
  const [hoveredKey, setHoveredKey] = useState<CarriesValue | null>(null);
  const [pulsingKey, setPulsingKey] = useState<CarriesValue | null>(null);

  const options: {key: CarriesValue; label: string}[] = [
    {key: 'a', label: cardA.fullName},
    {key: 'both', label: 'Both equally'},
    {key: 'b', label: cardB.fullName},
  ];

  const hasSelection = value !== null;
  const height = isMobile ? 44 : 48;

  const handleClick = (key: CarriesValue) => {
    setPulsingKey(key);
    onChange(key);
    setTimeout(() => setPulsingKey(null), 300);
  };

  return (
    <div
      role="radiogroup"
      aria-label="Which card carries this synergy"
      style={{
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        gap: isMobile ? 6 : SPACING.sm,
        width: '100%',
      }}>
      {options.map(({key, label}) => {
        const isSelected = value === key;
        const isHovered = hoveredKey === key;
        const isPulsing = pulsingKey === key;
        const isDimmed = hasSelection && !isSelected;

        const style: React.CSSProperties = {
          flex: 1,
          minWidth: 0,
          height,
          borderRadius: RADIUS.lg,
          cursor: 'pointer',
          fontSize: 13,
          fontFamily: FONTS.body,
          padding: '0 12px',
          transition: `all 0.3s ${EASING.bounce}`,
          animation: isPulsing ? 'idv-pulse 0.3s ease-out' : 'none',
          ...(isSelected
            ? {
                background: CARRIES_COLOR.hintBg,
                border: `2px solid ${CARRIES_COLOR.border}`,
                color: CARRIES_COLOR.border,
                fontWeight: 700,
                boxShadow: `0 0 16px ${CARRIES_COLOR.glow}`,
                opacity: 1,
              }
            : {
                background: isHovered ? CARRIES_COLOR.hintBg : 'rgba(255,255,255,0.03)',
                border: isHovered
                  ? `1px solid ${CARRIES_COLOR.hoverBorder}`
                  : '1px solid rgba(255,255,255,0.08)',
                color: isHovered ? COLORS.text : COLORS.textMuted,
                fontWeight: 500,
                boxShadow: isHovered ? `inset 0 0 12px ${CARRIES_COLOR.glow}` : 'none',
                opacity: isDimmed ? 0.45 : 1,
              }),
        };

        if (isMobile) {
          style.width = '100%';
          style.flex = 'none';
        }

        return (
          <button
            key={key}
            className="idv-option-btn"
            role="radio"
            aria-checked={isSelected}
            onClick={() => handleClick(key)}
            onMouseEnter={() => setHoveredKey(key)}
            onMouseLeave={() => setHoveredKey(null)}
            style={style}>
            {label}
          </button>
        );
      })}
    </div>
  );
}
