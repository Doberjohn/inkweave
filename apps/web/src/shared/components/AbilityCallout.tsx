import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../constants';

export type AbilityCalloutVariant = 'standalone' | 'stacked-after-tag';

interface AbilityCalloutProps {
  /** standalone: all corners rounded. stacked-after-tag: top-left corner flat (where a stacked AbilityTag sits above). */
  variant?: AbilityCalloutVariant;
  children: React.ReactNode;
}

const ABILITY_BOX_SHADOW =
  '0 3px 10px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.22), inset 0 -1px 0 rgba(0, 0, 0, 0.18)';

/**
 * Lorcana ability-box cream body. Carries the description / explanation text on a warm cream surface.
 * Pairs with `<AbilityTag variant="stacked">` above when used in the stacked layout.
 */
export function AbilityCallout({variant = 'standalone', children}: AbilityCalloutProps) {
  const r = `${RADIUS.sm}px`;
  return (
    <div
      style={{
        background: COLORS.lorcanaCream,
        color: COLORS.lorcanaTextDark,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.base}px`,
        fontWeight: 600,
        lineHeight: 1.4,
        padding: '10px 14px',
        borderRadius: variant === 'stacked-after-tag' ? `0 ${r} ${r} ${r}` : r,
        boxShadow: ABILITY_BOX_SHADOW,
      }}>
      {children}
    </div>
  );
}
