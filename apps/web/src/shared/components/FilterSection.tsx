import {COLORS, FONT_SIZES, SPACING} from '../constants';

interface FilterSectionProps {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
}

export function FilterSection({label, children, compact = false}: FilterSectionProps) {
  return (
    <div style={{marginBottom: compact ? `${SPACING.md}px` : `${SPACING.xl}px`}}>
      <div
        style={{
          fontSize: `${FONT_SIZES.base}px`,
          color: COLORS.gray700,
          marginBottom: compact ? '4px' : `${SPACING.sm}px`,
          fontWeight: 500,
          letterSpacing: '0.02em',
        }}>
        {label}
      </div>
      {children}
    </div>
  );
}
