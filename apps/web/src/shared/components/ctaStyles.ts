import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING, TOUCH_TARGET} from '../constants';

/**
 * The CtaButton BASE recipe (#509): metrics and typography, with no colour and no
 * interaction. Housed here beside the filled recipe so a non-button that must stay
 * a crawlable anchor can wear the WHOLE button, not just its paint — DecksPage's
 * "+ New deck" Link and CompactHeader's Reveals pill are both anchors by design
 * (middle-click, open-in-new-tab, crawlability), so neither can be a <button>.
 *
 * Before this existed, sharing only CTA_FILLED_STYLE meant anchors re-typed the
 * metrics by hand, which is the same copy-and-drift that let the header's font
 * weight diverge from the kit until 1da74c47.
 *
 * `display` is deliberately NOT here. CtaButton needs `flex` (block-level, so
 * `margin: 0 auto` centres it — AppLayout's retry button relies on exactly that),
 * while an inline anchor wants `inline-flex`. Each consumer states its own.
 */
export const CTA_BASE_STYLE: React.CSSProperties = {
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.sm,
  padding: `0 ${SPACING.xl}px`,
  minHeight: TOUCH_TARGET,
  borderRadius: `${RADIUS.lg}px`,
  fontFamily: FONTS.body,
  // The kit baseline (2026-07-31 ruling): every button is 14/600. Muted-grey
  // labels at 13/500 read thin on a dark ground — contrast was never the issue
  // (textMuted is 6.18-7.36:1, above AA everywhere), stroke weight was.
  fontSize: `${FONT_SIZES.lg}px`,
  fontWeight: 600,
  textDecoration: 'none',
};

/**
 * The CtaButton FILLED recipe (#509): the paint that turns the base into the
 * primary action. Kept separate so `ghost` / `neutral` can wear the base without it.
 *
 * Keeps its own `fontWeight` even though CTA_BASE_STYLE now sets the same value.
 * That is load-bearing, not redundant: CompactHeader's RevealsPill spreads ONLY
 * this recipe (it sets its own metrics, being a smaller pill), so dropping the
 * weight here would silently return that link to :root's 400.
 */
export const CTA_FILLED_STYLE: React.CSSProperties = {
  border: 'none',
  background: COLORS.filterGradient,
  color: COLORS.filterText,
  boxShadow: COLORS.filterShadow,
  fontWeight: 600,
};
