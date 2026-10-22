import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../constants';

export type AbilityTagVariant = 'stacked' | 'page';

interface AbilityTagProps {
  /**
   * Layout variant.
   * - `stacked`: rounded top corners (sits on top-left of a vertical callout via `<AbilityCallout variant="stacked-after-tag">`).
   * - `page`: same shape as stacked but larger font for full-page section headings.
   */
  variant?: AbilityTagVariant;
  children: React.ReactNode;
}

/**
 * Lorcana ability-box dark name tag. Pairs with `<AbilityCallout>` for the stacked / page
 * variants. (The previous `row` variant was retired when ConnectionGroup moved to an inline
 * floated label in the cream box itself.)
 */
export function AbilityTag({variant = 'stacked', children}: AbilityTagProps) {
  const isPage = variant === 'page';
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
        fontSize: isPage ? `${FONT_SIZES.xl}px` : `${FONT_SIZES.xs}px`,
        letterSpacing: isPage ? '0.06em' : '0.08em',
        textTransform: 'uppercase',
        padding: isPage
          ? `${SPACING.md}px ${SPACING.xxl}px`
          : `${SPACING.sm}px ${SPACING.section}px`,
        borderRadius: `${RADIUS.sm}px ${RADIUS.sm}px 0 0`,
      }}>
      {children}
    </span>
  );
}
