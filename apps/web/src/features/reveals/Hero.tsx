import {useEffect, useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import {useResponsive} from '../../shared/hooks';
import type {RevealPhase} from './useRevealPhase';

const SET_LOGO = '/art/sets/attack-of-the-vine.png';
const SUBTITLE = 'New IPs coming to Lorcana';
const ANIMATE_IN_MS = 240;
const ANIMATE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface HeroProps {
  phase: RevealPhase;
  days: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

function countdownLabel(phase: RevealPhase, days: number): string | null {
  if (phase === 'pre-release') {
    return days === 1 ? '1 day until pre-release' : `${days} days until pre-release`;
  }
  if (phase === 'pre-release-live') {
    const tail = days === 1 ? '1 day to wide release' : `${days} days to wide release`;
    return `Pre-release live · ${tail}`;
  }
  return null;
}

export function Hero({phase, days}: HeroProps) {
  const reduced = prefersReducedMotion();
  const {isMobile} = useResponsive();
  const [mounted, setMounted] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const label = countdownLabel(phase, days);

  const countdownStyle: React.CSSProperties = {
    fontFamily: FONTS.hero,
    fontSize: FONT_SIZES.xxl,
    color: COLORS.primary,
    textShadow: `0 0 12px ${COLORS.primary}80, 0 0 24px ${COLORS.primary}40`,
    letterSpacing: 0.5,
  };

  return (
    <header
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: reduced
          ? 'none'
          : `opacity ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}, transform ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}`,
        padding: `${SPACING.xxl}px ${SPACING.lg}px ${SPACING.lg}px`,
        textAlign: 'center',
      }}>
      <div style={{position: 'relative', width: '100%'}}>
        <img
          src={SET_LOGO}
          alt="Attack of the Vine!"
          style={{
            maxWidth: 320,
            width: '100%',
            height: 'auto',
            display: 'block',
            margin: '0 auto',
          }}
        />
        {label && !isMobile && (
          <div
            aria-live="polite"
            style={{
              ...countdownStyle,
              position: 'absolute',
              right: SPACING.xl,
              top: '50%',
              transform: 'translateY(-50%)',
            }}>
            {label}
          </div>
        )}
        {label && isMobile && (
          <div
            aria-live="polite"
            style={{...countdownStyle, marginTop: SPACING.md, textAlign: 'center'}}>
            {label}
          </div>
        )}
      </div>
      <p
        style={{
          margin: `${SPACING.md}px 0 ${SPACING.lg}px`,
          fontFamily: FONTS.body,
          fontSize: FONT_SIZES.base,
          color: COLORS.heroSubtitle,
        }}>
        {SUBTITLE}
      </p>
      <hr
        aria-hidden="true"
        style={{
          height: 1,
          border: 'none',
          background: `linear-gradient(90deg, transparent, ${COLORS.primary500} 50%, transparent)`,
          margin: 0,
        }}
      />
    </header>
  );
}
