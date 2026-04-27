import {useEffect, useState} from 'react';
import {useNavigate} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardGrid} from '../cards/components/CardGrid';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../../shared/constants';
import type {RevealTier} from './useRevealCards';

const ANIMATE_IN_MS = 240;
const ANIMATE_EASING = 'cubic-bezier(0.2, 0.8, 0.2, 1)';

interface FranchiseTierProps {
  tier: RevealTier;
  /** Number of initial tiles to load eagerly (priority). Use on the first above-fold tier only. */
  priorityCount?: number;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function FranchiseTier({tier, priorityCount = 0}: FranchiseTierProps) {
  const navigate = useNavigate();
  const reduced = prefersReducedMotion();
  const [mounted, setMounted] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [reduced]);

  const handleSelect = (card: LorcanaCard) => navigate(`/card/${card.id}`);

  return (
    <section
      aria-labelledby={`tier-${tier.id}`}
      style={{
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(16px)',
        transition: reduced
          ? 'none'
          : `opacity ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}, transform ${ANIMATE_IN_MS}ms ${ANIMATE_EASING}`,
        padding: `0 ${SPACING.lg}px`,
        marginBottom: SPACING.xxl,
      }}>
      <header
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: `${SPACING.xxl}px 0 ${SPACING.lg}px`,
        }}>
        {tier.logoUrl ? (
          <img
            src={tier.logoUrl}
            alt={tier.label}
            style={{height: 80, width: 'auto', maxWidth: '80%', objectFit: 'contain'}}
          />
        ) : (
          <h2
            id={`tier-${tier.id}`}
            style={{
              margin: 0,
              fontFamily: FONTS.hero,
              fontSize: FONT_SIZES.xxl,
              color: COLORS.text,
              fontWeight: 600,
              textAlign: 'center',
              letterSpacing: 0.5,
            }}>
            {tier.label}
          </h2>
        )}
        {tier.logoUrl && (
          <h2 id={`tier-${tier.id}`} style={{position: 'absolute', left: -10000, top: 'auto'}}>
            {tier.label}
          </h2>
        )}
      </header>
      <CardGrid
        cards={tier.cards}
        onSelect={handleSelect}
        priorityCount={priorityCount}
      />
    </section>
  );
}
