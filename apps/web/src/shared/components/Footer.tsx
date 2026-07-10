import {Link} from 'react-router-dom';
import {APP_NAME, COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';

/**
 * Site footer: legal/product navigation plus the Ravensburger Community Code
 * attribution notice (issue #219). Rendered on scrollable pages (Home and the
 * four legal pages), NOT globally in AppLayout: the height:100vh tool pages
 * (Browse, Vote) would push it below the fold or behind the fixed mobile nav.
 */

const CONTACT_EMAIL = 'support.inkweave@gmail.com';

const NAV_LINKS: {label: string; to: string}[] = [
  {label: 'About', to: '/about'},
  {label: 'Privacy', to: '/privacy'},
  {label: 'Terms', to: '/terms'},
  {label: 'Disclaimer', to: '/disclaimer'},
];

const linkStyle: React.CSSProperties = {
  color: COLORS.textMuted,
  textDecoration: 'none',
  fontSize: `${FONT_SIZES.xs}px`,
};

function Dot() {
  return (
    <span aria-hidden="true" style={{color: COLORS.textDim}}>
      &middot;
    </span>
  );
}

export function Footer() {
  return (
    <footer
      aria-label="Site footer"
      style={{
        // Positioned + z-index so the footer paints ABOVE the home page's
        // fixed EtherealBackground (position:fixed; z-index:0). Without this,
        // that full-viewport gradient paints over the static footer and hides
        // it, while its pointer-events:none lets clicks reach the links — the
        // "there and clickable but invisible" bug.
        position: 'relative',
        zIndex: 1,
        borderTop: `1px solid ${COLORS.surfaceBorder}`,
        background: COLORS.background,
        padding: `${SPACING.xxl}px ${SPACING.lg}px`,
        fontFamily: FONTS.body,
      }}>
      <div
        style={{
          maxWidth: 860,
          margin: '0 auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: `${SPACING.md}px`,
          textAlign: 'center',
        }}>
        <nav
          aria-label="Legal and product links"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            alignItems: 'center',
            gap: `${SPACING.sm}px`,
            fontSize: `${FONT_SIZES.xs}px`,
          }}>
          <span style={{color: COLORS.text, fontWeight: 700}}>{APP_NAME}</span>
          <span style={{color: COLORS.textMuted}}>unofficial Disney Lorcana synergy finder</span>
          {NAV_LINKS.map((item) => (
            <span
              key={item.to}
              style={{display: 'inline-flex', alignItems: 'center', gap: `${SPACING.sm}px`}}>
              <Dot />
              <Link to={item.to} style={linkStyle}>
                {item.label}
              </Link>
            </span>
          ))}
          <span style={{display: 'inline-flex', alignItems: 'center', gap: `${SPACING.sm}px`}}>
            <Dot />
            <a href={`mailto:${CONTACT_EMAIL}`} style={linkStyle}>
              {CONTACT_EMAIL}
            </a>
          </span>
        </nav>

        <p
          style={{
            margin: 0,
            maxWidth: 620,
            color: COLORS.textMuted,
            fontSize: `${FONT_SIZES.xs}px`,
            lineHeight: 1.6,
          }}>
          {APP_NAME} uses trademarks and/or copyrights associated with Disney Lorcana TCG, used under
          Ravensburger&rsquo;s Community Code Policy. We are expressly prohibited from charging you to use or
          access this content. {APP_NAME} is not published, endorsed, or specifically approved by Disney or
          Ravensburger. For more information about Disney Lorcana TCG, visit{' '}
          <a
            href="https://www.disneylorcana.com"
            target="_blank"
            rel="noreferrer"
            style={{color: COLORS.primary, textDecoration: 'underline'}}>
            disneylorcana.com
          </a>
          .
        </p>
      </div>
    </footer>
  );
}
