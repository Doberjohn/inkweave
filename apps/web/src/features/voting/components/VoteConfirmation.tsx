import {useEffect, useState} from 'react';
import {COLORS, EASING, FONTS, FONT_SIZES, RADIUS, TIER_COLORS, Z_INDEX, hexRgba} from '../../../shared/constants';
import {Sparkles} from '../../../shared/components/Sparkles';
import {useScrollLock} from '../../../shared/hooks';
import type {Score} from '../../../shared/lib/supabase';
import {getStrengthTier} from '../../synergies/utils/scoreUtils';

interface VoteConfirmationProps {
  score: Score;
  engineScore: number;
  whoCarries: 'a' | 'b' | 'both' | null;
  cardAName: string;
  cardBName: string;
  onComplete: () => void;
}

const AUTO_ADVANCE_MS = 2500;

function ScoreCircle({score, size}: {score: number; size: number}) {
  const tier = getStrengthTier(score);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: tier.bg,
        border: `2px solid ${tier.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <span
        style={{
          fontSize: size > 40 ? FONT_SIZES.xxl : FONT_SIZES.xl,
          fontWeight: 700,
          color: tier.color,
          fontFamily: FONTS.body,
        }}>
        {score}
      </span>
    </div>
  );
}

/**
 * Full-screen auto-advancing vote celebration. Deliberately non-dismissable
 * (no Escape/backdrop close — it advances itself in 2.5s), so it is a status
 * region, not a dialog (#510). Sits on the toast tier so it survives any open
 * modal, and locks the page scroll for its lifetime.
 */
export function VoteConfirmation({
  score,
  engineScore,
  whoCarries,
  cardAName,
  cardBName,
  onComplete,
}: VoteConfirmationProps) {
  const [visible, setVisible] = useState(false);

  useScrollLock(true);

  const carriesLabel =
    whoCarries === 'a' ? cardAName : whoCarries === 'b' ? cardBName : 'Both equally';

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onComplete, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: hexRgba(COLORS.background, 0.85),
        zIndex: Z_INDEX.toast,
        opacity: visible ? 1 : 0,
        transition: `opacity 0.3s ${EASING.smooth}`,
      }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '32px 24px',
          borderRadius: RADIUS.xl,
          background: COLORS.surface,
          border: `1px solid ${COLORS.surfaceBorder}`,
          boxShadow: `0 8px 32px ${hexRgba(COLORS.primary500, 0.15)}`,
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: `transform 0.3s ${EASING.bounce}`,
          maxWidth: 360,
        }}>
        {/* Checkmark with sparkles */}
        <Sparkles color={TIER_COLORS.strong.color} minSize={3} maxSize={8} rate={350}>
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              background: TIER_COLORS.strong.bg,
              border: `2px solid ${TIER_COLORS.strong.color}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: FONT_SIZES.displaySm,
            }}>
            <span style={{color: TIER_COLORS.strong.color}}>✓</span>
          </div>
        </Sparkles>

        <span style={{fontSize: FONT_SIZES.xxl, fontWeight: 700, color: COLORS.text, fontFamily: FONTS.body}}>
          Vote recorded!
        </span>

        {/* Score comparison */}
        <div style={{display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center'}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontFamily: FONTS.body}}>Your rating</span>
            <ScoreCircle score={score} size={48} />
          </div>

          <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body, fontStyle: 'italic'}}>
            vs
          </span>

          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textMuted, fontFamily: FONTS.body}}>Engine score</span>
            <ScoreCircle score={engineScore} size={48} />
          </div>
        </div>

        {/* Carries */}
        {whoCarries && (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body}}>Carries:</span>
            <span style={{fontSize: FONT_SIZES.base, fontWeight: 600, color: COLORS.primary500, fontFamily: FONTS.body}}>
              {carriesLabel}
            </span>
          </div>
        )}

        <span style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, fontFamily: FONTS.body}}>Loading next pair...</span>
      </div>
    </div>
  );
}
