import type {CSSProperties} from 'react';
import discordLogo from '../../assets/discord.svg?no-inline';
import {SHOW_COLLECTION} from '../../features/collection/flag';
import {
  CAP_LABEL_XS,
  COLORS,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  PROVIDER_COLORS,
  RADIUS,
  SHADOWS,
  SPACING,
  TOUCH_TARGET,
} from '../constants';

/** The Discord server's invite, set never to expire. */
export const DISCORD_INVITE_URL = 'https://discord.gg/gvA6qUUPE';

/**
 * The card's look. Where it sits and how wide it is change with the screen, so they live in
 * index.css's `.beta-notice` media queries alone: an inline value would beat them. The CSS
 * variables hand that stylesheet its spacing from the tokens.
 */
const CARD_STYLE = {
  '--beta-notice-edge': `${SPACING.lg}px`,
  '--beta-notice-top': `${SPACING.xxl}px`,
  '--beta-notice-gutter': `${SPACING.xxxl}px`,
  boxSizing: 'border-box',
  display: 'flex',
  gap: SPACING.lg,
  padding: SPACING.xl,
  borderRadius: RADIUS.card,
  background: `linear-gradient(180deg, ${COLORS.surfaceRaised} 0%, ${COLORS.surfaceAlt} 100%)`,
  border: `1px solid ${GOLD_GLOW.activeBorder}`,
  boxShadow: `${SHADOWS.panel}, ${GOLD_GLOW.shadow}`,
  color: COLORS.text,
  fontFamily: FONTS.body,
} as CSSProperties;

const PILL_STYLE: CSSProperties = {
  ...CAP_LABEL_XS,
  display: 'inline-block',
  padding: `${SPACING.xxs}px ${SPACING.sm}px`,
  borderRadius: RADIUS.pill,
  background: GOLD_GLOW.activeBg,
  border: `1px solid ${GOLD_GLOW.activeBorder}`,
  color: COLORS.primary,
};

const TITLE_STYLE: CSSProperties = {
  margin: `${SPACING.sm}px 0 ${SPACING.xs}px`,
  fontFamily: FONTS.hero,
  fontWeight: 400,
  fontSize: FONT_SIZES.xxxl,
  lineHeight: 1.2,
};

const LINE_STYLE: CSSProperties = {
  margin: 0,
  fontSize: FONT_SIZES.lg,
  lineHeight: 1.5,
  color: COLORS.heroSubtitle,
};

const LINK_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.sm,
  minHeight: TOUCH_TARGET,
  padding: `0 ${SPACING.lg}px`,
  borderRadius: RADIUS.lg,
  background: PROVIDER_COLORS.discord.bg,
  color: PROVIDER_COLORS.discord.text,
  fontSize: FONT_SIZES.lg,
  fontWeight: 600,
  textDecoration: 'none',
  whiteSpace: 'nowrap',
};

/**
 * The home page's beta notice: says what is in beta, thanks the people testing it, and invites
 * them to the Discord, where bugs and ideas go. Rendered before the page's `<main>`, since a
 * complementary landmark belongs at the top level.
 */
export function BetaNotice() {
  // What the beta covers: the collection once it is on, the whole site before then.
  const subject = SHOW_COLLECTION ? 'Collection' : 'Inkweave';
  return (
    <aside aria-label="Beta notice" className="beta-notice" style={CARD_STYLE}>
      <div className="beta-notice-copy">
        <span style={PILL_STYLE}>Beta</span>
        <p style={TITLE_STYLE}>{subject} is in beta</p>
        <p style={LINE_STYLE}>Thanks for testing! Found a bug or have an idea? Tell us on Discord.</p>
      </div>
      <a
        className="beta-notice-link"
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        style={LINK_STYLE}>
        <img src={discordLogo} alt="" width={20} height={15} />
        Join our Discord
      </a>
    </aside>
  );
}
