import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';

export type AbilityTagVariant = 'row' | 'stacked';

interface AbilityTagProps {
  /** Layout variant: row sits on the left of a horizontal callout (banner slope on right edge); stacked sits on top-left of a vertical callout (rounded top corners only). */
  variant?: AbilityTagVariant;
  children: React.ReactNode;
}

// Banner slope on the right edge — gives the row variant a flag/tag shape that flows into the cream body
const ROW_CLIP_PATH = 'polygon(0 0, calc(100% - 9px) 0, 100% 100%, 0 100%)';

/**
 * Lorcana ability-box dark name tag. Pairs with `<AbilityCallout>` for the stacked variant
 * or sits inside a flex-row cream container for the row variant.
 */
export function AbilityTag({variant = 'row', children}: AbilityTagProps) {
  const isRow = variant === 'row';
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        flexShrink: 0,
        whiteSpace: 'nowrap',
        background: COLORS.lorcanaTagBg,
        color: COLORS.lorcanaTagText,
        fontFamily: FONTS.body,
        fontWeight: 700,
        fontSize: `${FONT_SIZES.xs}px`,
        letterSpacing: '0.08em',
        textTransform: 'uppercase',
        padding: isRow ? '6px 16px 6px 12px' : '6px 14px',
        clipPath: isRow ? ROW_CLIP_PATH : undefined,
        borderRadius: isRow ? 0 : `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
      }}>
      {children}
    </span>
  );
}
