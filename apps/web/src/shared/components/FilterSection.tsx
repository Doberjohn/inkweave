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
          fontSize: `${FONT_SIZES.sm}px`,
          color: COLORS.gray500,
          marginBottom: compact ? '4px' : `${SPACING.sm}px`,
          fontWeight: 500,
        }}>
        {label}
      </div>
      {children}
    </div>
  );
}
