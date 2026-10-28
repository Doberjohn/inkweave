import {COLORS, hexRgba} from '../tokens/theme';

/**
 * The CtaButton filled recipe (#509), housed outside the component so non-button
 * surfaces that must stay crawlable anchors (e.g. the header Reveals NavLink
 * wearing the pill variant) can share it without breaking Fast Refresh.
 */
export const CTA_FILLED_STYLE: React.CSSProperties = {
  border: 'none',
  background: COLORS.filterGradient,
  color: COLORS.filterText,
  boxShadow: COLORS.filterShadow,
};

/** The CtaButton ghost recipe, for a link that must look like the ghost button (View binder). */
export const CTA_GHOST_STYLE: React.CSSProperties = {
  background: 'transparent',
  color: COLORS.primary,
  border: `1px solid ${hexRgba(COLORS.primary, 0.4)}`,
};
