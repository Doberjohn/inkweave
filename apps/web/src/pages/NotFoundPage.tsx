import {useLocation, useNavigate} from 'react-router-dom';
import {COLORS, FONTS, hexRgba} from '../shared/constants';
import {FullPageNotice} from '../shared/components/FullPageNotice';
import {Seo} from '../shared/components';

/**
 * The 404's oversized numeral: the one hero mark that earns its size, because it
 * IS the error code rather than decoration. Passed to FullPageNotice's `hero`
 * slot, and carries the page's <h1> (the notice's own title is an h2 beneath it).
 *
 * The gradient was two golds, the legacy accent fading into the brand one. Only
 * one gold token is legal now, so it is one hue at three alpha steps: dimmer at
 * the top, full through the middle, fading out at the base. Owner ruling
 * 2026-07-30, taken when this file left the grandfather ledger.
 */
function GoldNumeral() {
  return (
    <h1
      style={{
        margin: 0,
        fontFamily: FONTS.hero,
        fontSize: 'clamp(100px, 20vw, 180px)',
        fontWeight: 400,
        letterSpacing: 8,
        lineHeight: 1,
        background: `linear-gradient(180deg, ${hexRgba(COLORS.primary, 0.75)} 0%, ${COLORS.primary} 50%, ${hexRgba(COLORS.primary, 0.5)} 100%)`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}>
      404
    </h1>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  return (
    <>
      {/*
        vercel.json rewrites every extensionless path to dist/index.html, which prerender.mjs
        overwrote with the HOME route's render — so an unknown URL returns HTTP 200 carrying
        home's title and canonical="/" (#525). public/404.html has a noindex but is unreachable
        through that rewrite. This is the only thing that tells a crawler not to index junk URLs.
        Self-referential canonical, not "/", so Google does not consolidate junk into the homepage.
      */}
      <Seo title="Page not found | Inkweave" canonicalPath={pathname} noindex />
      <FullPageNotice
        hero={<GoldNumeral />}
        title="Lost in the Inkwell"
        lines={[
          'This page has vanished into the mists of Lorcana.',
          'Perhaps it was banished, or simply never existed.',
        ]}
        ctaLabel="Return to Inkweave"
        onCta={() => navigate('/')}
      />
    </>
  );
}
