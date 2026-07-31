import {COLORS} from '../constants';

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
  // 600, not the kit's base 500: dark text on a saturated gradient needs the extra
  // stroke to hold its weight, where an outlined variant on a dark ground does not.
  // Part of the recipe rather than the button, so the pill variant and the header's
  // NavLink inherit it — the header used to restate it locally and drift was possible.
  fontWeight: 600,
};
