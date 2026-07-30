import {useLocation, useNavigate} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, INK_COLORS, SPACING} from '../shared/constants';
import {CtaButton} from '../shared/components/CtaButton';
import {Seo} from '../shared/components';

/**
 * The page is one composed scene, so the decorative layers live here as local
 * components rather than inline. Keeping them separate is what holds NotFoundPage
 * itself under the Large Method threshold as content is added (#525 pushed the
 * single-function form to 179 lines against a limit of 120).
 *
 * Deliberately NOT shared with EtherealBackground: this glow is bespoke to the 404
 * scene (different size, gradient stops and offset), and unifying them would change
 * how the page looks.
 */
function EtherealGlow() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        width: 600,
        height: 400,
        borderRadius: '50%',
        background:
          'radial-gradient(ellipse at center, rgba(139, 92, 246, 0.12) 0%, rgba(212, 175, 55, 0.06) 40%, transparent 70%)',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -55%)',
        pointerEvents: 'none',
      }}
    />
  );
}

// Sparkle accents read from the ink tokens rather than copied hexes: the copies
// were the OLD Amethyst/Emerald values and were orphaned by the 2026-07-30 ink
// repalette, leaving decorative colours that belonged to no ink at all.
const SPARKLES = [
  {x: '19%', y: '22%', size: 3, color: COLORS.primary500, opacity: 0.3},
  {x: '76%', y: '33%', size: 2, color: INK_COLORS.Amethyst.border, opacity: 0.25},
  {x: '24%', y: '75%', size: 4, color: COLORS.primary500, opacity: 0.2},
  {x: '73%', y: '69%', size: 2.5, color: INK_COLORS.Amethyst.border, opacity: 0.2},
  {x: '35%', y: '17%', size: 2, color: COLORS.primary500, opacity: 0.3},
  {x: '64%', y: '20%', size: 3, color: INK_COLORS.Emerald.border, opacity: 0.2},
];

function SparkleField() {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
      }}>
      {SPARKLES.map((s, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: s.x,
            top: s.y,
            width: s.size,
            height: s.size,
            borderRadius: '50%',
            background: s.color,
            opacity: s.opacity,
            boxShadow: `0 0 ${s.size * 3}px ${s.color}`,
          }}
        />
      ))}
    </div>
  );
}

function BrandWatermark() {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        bottom: SPACING.xxl,
        fontFamily: FONTS.hero,
        fontSize: `${FONT_SIZES.md}px`,
        letterSpacing: 4,
        color: 'rgba(144, 161, 185, 0.25)',
      }}>
      INKWEAVE
    </span>
  );
}

function LostInTheInkwell({onReturnHome}: {onReturnHome: () => void}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: `0 ${SPACING.xl}px`,
      }}>
      {/* 404 number */}
      <h1
        style={{
          margin: 0,
          fontFamily: FONTS.hero,
          fontSize: 'clamp(100px, 20vw, 180px)',
          fontWeight: 400,
          letterSpacing: 8,
          lineHeight: 1,
          background:
            'linear-gradient(180deg, #d4af37 0%, #ffb900 50%, rgba(212, 175, 55, 0.5) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
        }}>
        404
      </h1>

      {/* Gold gradient divider */}
      <div
        aria-hidden="true"
        style={{
          width: 200,
          height: 2,
          background: 'linear-gradient(90deg, transparent 0%, #d4af37 50%, transparent 100%)',
          marginTop: SPACING.xs,
        }}
      />

      {/* Title */}
      <h2
        style={{
          margin: 0,
          marginTop: SPACING.xxl,
          fontFamily: FONTS.hero,
          fontSize: `clamp(${FONT_SIZES.xxl}px, 4vw, 28px)`,
          fontWeight: 400,
          color: COLORS.text,
          letterSpacing: 2,
        }}>
        Lost in the Inkwell
      </h2>

      {/* Description */}
      <p
        style={{
          margin: 0,
          marginTop: SPACING.md,
          fontSize: `${FONT_SIZES.xl}px`,
          color: COLORS.textMuted,
          textAlign: 'center',
        }}>
        This page has vanished into the mists of Lorcana.
      </p>
      <p
        style={{
          margin: 0,
          marginTop: SPACING.sm,
          fontSize: `${FONT_SIZES.lg}px`,
          color: 'rgba(144, 161, 185, 0.5)',
          textAlign: 'center',
        }}>
        Perhaps it was banished, or simply never existed.
      </p>

      {/* CTA Button */}
      <CtaButton onClick={onReturnHome} style={{marginTop: 36}}>
        {/* Sparkle icon */}
        <svg
          width="16"
          height="16"
          viewBox="3.5 2 17 16"
          fill="none"
          aria-hidden="true"
          style={{flexShrink: 0}}>
          <path
            d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z"
            fill={COLORS.filterText}
            stroke={COLORS.filterText}
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
        </svg>
        Return to Inkweave
      </CtaButton>
    </div>
  );
}

export function NotFoundPage() {
  const navigate = useNavigate();
  const {pathname} = useLocation();

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexDirection: 'column',
        fontFamily: FONTS.body,
        position: 'relative',
        overflow: 'hidden',
      }}>
      {/*
        vercel.json rewrites every extensionless path to dist/index.html, which prerender.mjs
        overwrote with the HOME route's render — so an unknown URL returns HTTP 200 carrying
        home's title and canonical="/" (#525). public/404.html has a noindex but is unreachable
        through that rewrite. This is the only thing that tells a crawler not to index junk URLs.
        Self-referential canonical, not "/", so Google does not consolidate junk into the homepage.
      */}
      <Seo title="Page not found | Inkweave" canonicalPath={pathname} noindex />
      <EtherealGlow />
      <SparkleField />
      <LostInTheInkwell onReturnHome={() => navigate('/')} />
      <BrandWatermark />
    </main>
  );
}
