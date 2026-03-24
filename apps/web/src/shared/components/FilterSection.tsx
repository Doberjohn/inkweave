import {COLORS, FONT_SIZES, SPACING} from '../constants';

interface FilterSectionProps {
  label: string;
  children: React.ReactNode;
  compact?: boolean;
  /** Hide the bottom divider (e.g. for sub-sections within a group) */
  noDivider?: boolean;
}

export function FilterSection({label, children, compact = false, noDivider = false}: FilterSectionProps) {
  return (
    <div
      style={{
        paddingBottom: compact ? `${SPACING.md}px` : `${SPACING.xl}px`,
        marginBottom: compact ? `${SPACING.md}px` : `${SPACING.xl}px`,
        ...(noDivider
          ? {}
          : {borderBottom: `1px solid rgba(212, 175, 55, 0.12)`}),
      }}>
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
