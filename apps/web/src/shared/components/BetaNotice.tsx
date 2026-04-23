import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../constants';

/**
 * Persistent beta-warning card on the landing page, top-left.
 *
 * Non-dismissable — the notice stays visible for the duration of the beta.
 * Turn off site-wide via `VITE_SHOW_BETA_NOTICE=false` when no longer needed
 * (e.g., at v1.0.0 launch). Desktop-only — see `AppLayout.tsx` for the
 * `isHome && !isMobile` gate.
 */
export function BetaNotice() {
  return (
    <aside
      aria-label="Beta notice"
      style={{
        position: 'fixed',
        left: 32,
        top: 32,
        maxWidth: 320,
        padding: `${SPACING.md}px ${SPACING.lg}px`,
        borderRadius: RADIUS.lg,
        background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
        border: `1px solid ${COLORS.surfaceBorder}`,
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 16px rgba(212, 175, 55, 0.12)',
        color: COLORS.text,
        fontFamily: FONTS.body,
        fontSize: `${FONT_SIZES.sm}px`,
        lineHeight: 1.5,
        zIndex: 800,
      }}>
      <span
        style={{
          display: 'inline-block',
          fontSize: `${FONT_SIZES.xs}px`,
          fontWeight: 700,
          letterSpacing: 0.6,
          textTransform: 'uppercase',
          color: COLORS.primary,
          marginRight: 8,
        }}>
        Beta
      </span>
      Inkweave is in beta — you may encounter bugs. Thanks for testing!
    </aside>
  );
}
