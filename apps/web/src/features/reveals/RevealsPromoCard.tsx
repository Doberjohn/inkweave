import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {COLORS, FONTS, FONT_SIZES, RADIUS} from '../../shared/constants';
import {useResponsive} from '../../shared/hooks';

const SET_LOGO = '/art/sets/attack-of-the-vine.png';

/** Staggered firefly configs — stable across renders so animations stay in sync. */
const FIREFLY_SEEDS: ReadonlyArray<{left: string; delay: string; drift: string}> = [
  {left: '6%', delay: '0s', drift: '12px'},
  {left: '14%', delay: '3.8s', drift: '-8px'},
  {left: '23%', delay: '1.2s', drift: '10px'},
  {left: '32%', delay: '5.4s', drift: '-14px'},
  {left: '40%', delay: '2.3s', drift: '16px'},
  {left: '48%', delay: '0.7s', drift: '-6px'},
  {left: '56%', delay: '4.1s', drift: '8px'},
  {left: '64%', delay: '6.2s', drift: '-12px'},
  {left: '72%', delay: '1.9s', drift: '14px'},
  {left: '80%', delay: '5.7s', drift: '-10px'},
  {left: '88%', delay: '3.0s', drift: '-16px'},
  {left: '94%', delay: '6.8s', drift: '4px'},
];

/**
 * Inject keyframes + :hover rules once per document.
 * Mirrors the pattern used by shared/components/Sparkles.tsx.
 *
 * Transition is declared on the class (not inline) so the `:hover` rule can
 * override scale/translate/box-shadow. An inline `transition: ...` would
 * collapse `transition-property` to whatever it mentions, making the rest snap.
 *
 * Hover scoped to `@media (hover: hover)` so touch devices don't get sticky
 * hover state after taps.
 */
(function injectStyles() {
  const STYLE_ID = 'reveals-promo-card-styles';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .rpc-card {
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 24px rgba(255, 185, 0, 0.22);
      cursor: pointer;
      transition: opacity 240ms cubic-bezier(0.2, 0.8, 0.2, 1),
                  scale 300ms cubic-bezier(0.2, 0.8, 0.2, 1),
                  translate 300ms cubic-bezier(0.2, 0.8, 0.2, 1),
                  box-shadow 300ms cubic-bezier(0.2, 0.8, 0.2, 1);
    }
    @media (hover: hover) {
      .rpc-card:hover {
        scale: 1.03;
        translate: 0 -4px;
        box-shadow: 0 14px 40px rgba(0, 0, 0, 0.6), 0 0 56px rgba(255, 185, 0, 0.6);
      }
      .rpc-card:hover .rpc-firefly {
        animation-duration: 2.2s;
      }
    }
    .rpc-firefly {
      position: absolute;
      width: 4px;
      height: 4px;
      border-radius: 50%;
      background: #ffb900;
      box-shadow: 0 0 6px #ffb900, 0 0 14px rgba(255, 185, 0, 0.6);
      pointer-events: none;
      opacity: 0;
      bottom: -8px;
      animation: rpc-firefly-rise 7s linear infinite;
    }
    @keyframes rpc-firefly-rise {
      0%   { transform: translate(0, 0) scale(0.8); opacity: 0; }
      12%  { opacity: 1; }
      50%  { transform: translate(var(--rpc-drift, 0), -130px) scale(1.1); opacity: 0.9; }
      85%  { transform: translate(calc(var(--rpc-drift, 0) * 2), -220px) scale(0.9); opacity: 0.35; }
      100% { transform: translate(calc(var(--rpc-drift, 0) * 2), -260px) scale(0.7); opacity: 0; }
    }
    @media (prefers-reduced-motion: reduce) {
      .rpc-card { transition: none; }
      .rpc-card:hover {
        scale: 1;
        translate: 0 0;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5), 0 0 32px rgba(255, 185, 0, 0.3);
      }
      .rpc-firefly { display: none; }
    }
  `;
  document.head.appendChild(style);
})();

// =====================================================================
// Domain types + capability check.
// =====================================================================

/** Responsive viewport config. Mirrors the CompactHeader pattern. */
interface ViewportConfig {
  isMobile: boolean;
}

/**
 * Check whether the user has requested reduced motion.
 * Three-guard form keeps each conditional simple (0 logical operators)
 * rather than one compound expression, which trips CodeScene's
 * Complex Conditional rule.
 */
function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

// =====================================================================
// Style helpers — module-level, each takes a ViewportConfig object so
// the Primitive Obsession rule doesn't fire on a mobile-boolean parade.
// =====================================================================

function getAsideStyle(viewport: ViewportConfig, mounted: boolean): React.CSSProperties {
  const base: React.CSSProperties = {
    position: 'fixed',
    background: `linear-gradient(180deg, ${COLORS.surface} 0%, ${COLORS.surfaceAlt} 100%)`,
    color: COLORS.text,
    zIndex: 800,
    opacity: mounted ? 1 : 0,
    overflow: 'hidden',
  };
  if (viewport.isMobile) {
    return {
      ...base,
      left: 0,
      right: 0,
      bottom: 0,
      width: '100%',
      borderTop: `1px solid ${COLORS.primary500}`,
      // No border radius or side/bottom borders — flush with viewport edges.
    };
  }
  return {
    ...base,
    right: 32,
    top: 32,
    width: 280,
    maxWidth: 'calc(100vw - 32px)',
    borderRadius: RADIUS.xl,
    border: `1px solid ${COLORS.primary500}`,
  };
}

function getButtonStyle(viewport: ViewportConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    color: 'inherit',
    cursor: 'pointer',
    font: 'inherit',
    position: 'relative',
    zIndex: 2,
  };
  if (viewport.isMobile) {
    return {
      ...base,
      display: 'flex',
      alignItems: 'center',
      gap: 16,
      width: '100%',
      textAlign: 'left',
      padding: '14px 20px',
    };
  }
  return {
    ...base,
    display: 'block',
    width: '100%',
    textAlign: 'center',
    padding: '20px 20px 24px',
    borderRadius: RADIUS.xl,
  };
}

function getLogoStyle(viewport: ViewportConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'block',
    maxWidth: '100%',
    height: 'auto',
    userSelect: 'none',
    flexShrink: 0,
  };
  if (viewport.isMobile) {
    return {...base, width: 100, margin: 0};
  }
  return {...base, width: 160, margin: '4px auto 18px'};
}

function getCopyBlockStyle(viewport: ViewportConfig): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
  };
  if (viewport.isMobile) return {...base, flex: 1};
  return base;
}

function getTitleStyle(viewport: ViewportConfig): React.CSSProperties {
  return {
    display: 'block',
    fontFamily: FONTS.body,
    fontSize: viewport.isMobile ? 16 : 18,
    fontWeight: 600,
    color: COLORS.text,
    margin: 0,
    lineHeight: 1.25,
  };
}

const NEW_BADGE_STYLE: React.CSSProperties = {
  display: 'block',
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.xs,
  fontWeight: 700,
  color: COLORS.primary500,
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  margin: '0 0 6px',
};

// =====================================================================
// Subcomponent — the ambient firefly cluster, only rendered when motion
// is allowed. Kept separate so the parent is pure layout.
// =====================================================================

function FireflyField() {
  return (
    <>
      {FIREFLY_SEEDS.map((seed, i) => (
        <span
          key={i}
          className="rpc-firefly"
          aria-hidden="true"
          style={
            {
              left: seed.left,
              animationDelay: seed.delay,
              ['--rpc-drift' as string]: seed.drift,
            } as React.CSSProperties
          }
        />
      ))}
    </>
  );
}

// =====================================================================
// Public component.
// =====================================================================

export function RevealsPromoCard() {
  const navigate = useNavigate();
  const {isMobile} = useResponsive();
  const viewport: ViewportConfig = {isMobile};
  const reduced = prefersReducedMotion();
  const [mounted, setMounted] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  return (
    <aside aria-label="Set 13 reveals" className="rpc-card" style={getAsideStyle(viewport, mounted)}>
      <button type="button" onClick={() => navigate('/reveals')} style={getButtonStyle(viewport)}>
        <img
          src={SET_LOGO}
          alt=""
          aria-hidden="true"
          draggable={false}
          style={getLogoStyle(viewport)}
        />
        <span style={getCopyBlockStyle(viewport)}>
          <span style={NEW_BADGE_STYLE}>NEW</span>
          <span style={getTitleStyle(viewport)}>Set 13 reveals are here!</span>
        </span>
      </button>
      {!reduced && <FireflyField />}
    </aside>
  );
}
