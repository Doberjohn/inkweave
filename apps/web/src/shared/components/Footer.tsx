import {Link} from 'react-router-dom';
import {INK_HUBS} from '../../features/cards/inkHubs';
import {APP_NAME, COLORS, FONTS, FONT_SIZES, INK_COLORS, SPACING} from '../constants';

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

/**
 * Six links to the ink hub pages (#530) — the step that actually closes the orphan gap.
 *
 * The Footer already renders on CardPage, so these six anchors put every hub ONE click
 * from all 1,024 card pages, and every card one click back from its hub. Ink is a total
 * partition of the corpus, so this is what guarantees no card is reachable only via the
 * sitemap: synergy adjacency truncates at `maxVisibleCards` (5 on mobile, and Googlebot
 * renders mobile), and playstyle membership covers just 682 of 1,024 cards.
 *
 * Kept as its own labelled <nav> rather than appended to NAV_LINKS so the legal/product
 * group stays visually and semantically distinct — and so screen-reader users get a
 * meaningful landmark name instead of eleven undifferentiated links.
 */
function InkHubNav() {
  return (
    <nav
      aria-label="Browse cards by ink"
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'center',
        alignItems: 'center',
        gap: `${SPACING.sm}px`,
        fontSize: `${FONT_SIZES.xs}px`,
      }}>
      {/* textMuted, NOT textDim: #666680 on the #0d0d14 background gives a contrast ratio
          of 3.48 at this 10px size, failing WCAG AA's 4.5:1 and breaking the axe audits on
          every page that renders the footer. textDim is only safe on larger text or as a
          decorative glyph — which is why the separator dots below still use it. */}
      <span style={{color: COLORS.textMuted}}>Cards by ink</span>
      {INK_HUBS.map((hub) => (
        <span
          key={hub.slug}
          style={{display: 'inline-flex', alignItems: 'center', gap: `${SPACING.xs}px`}}>
          <span
            aria-hidden="true"
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: INK_COLORS[hub.ink].border,
              flexShrink: 0,
            }}
          />
          <Link to={`/ink/${hub.slug}`} style={linkStyle}>
            {hub.ink}
          </Link>
        </span>
      ))}
    </nav>
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

        <InkHubNav />

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
