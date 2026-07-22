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
};
