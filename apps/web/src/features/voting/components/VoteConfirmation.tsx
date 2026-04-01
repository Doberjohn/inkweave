import {useEffect, useState} from 'react';
import {FONTS} from '../../../shared/constants';
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
        borderRadius: size / 2,
        background: tier.bg,
        border: `2px solid ${tier.color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <span style={{fontSize: size > 40 ? 20 : 16, fontWeight: 700, color: tier.color, fontFamily: FONTS.body}}>
        {score}
      </span>
    </div>
  );
}

export function VoteConfirmation({
  score,
  engineScore,
  whoCarries,
  cardAName,
  cardBName,
  onComplete,
}: VoteConfirmationProps) {
  const [visible, setVisible] = useState(false);

  const carriesLabel =
    whoCarries === 'a' ? cardAName : whoCarries === 'b' ? cardBName : 'Both equally';

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true));
    const timer = setTimeout(onComplete, AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(13, 13, 20, 0.85)',
        zIndex: 1000,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.3s ease',
      }}>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          padding: '32px 24px',
          borderRadius: 16,
          background: '#1a1a2e',
          border: '1px solid #333355',
          boxShadow: '0 8px 32px rgba(212, 175, 55, 0.15)',
          transform: visible ? 'scale(1)' : 'scale(0.95)',
          transition: 'transform 0.3s ease',
          maxWidth: 360,
        }}>
        {/* Checkmark */}
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 32,
            background: '#1a3d1a',
            border: '2px solid #6ee7a0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 28,
          }}>
          <span style={{color: '#6ee7a0'}}>✓</span>
        </div>

        <span style={{fontSize: 20, fontWeight: 700, color: '#e8e8e8', fontFamily: FONTS.body}}>
          Vote recorded!
        </span>

        {/* Score comparison */}
        <div style={{display: 'flex', alignItems: 'center', gap: 24, justifyContent: 'center'}}>
          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 10, color: '#90a1b9', fontFamily: FONTS.body}}>Your rating</span>
            <ScoreCircle score={score} size={48} />
          </div>

          <span style={{fontSize: 13, color: '#90a1b9', fontFamily: FONTS.body, fontStyle: 'italic'}}>
            vs
          </span>

          <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6}}>
            <span style={{fontSize: 10, color: '#90a1b9', fontFamily: FONTS.body}}>Engine score</span>
            <ScoreCircle score={engineScore} size={48} />
          </div>
        </div>

        {/* Carries */}
        {whoCarries && (
          <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
            <span style={{fontSize: 13, color: '#90a1b9', fontFamily: FONTS.body}}>Carries:</span>
            <span style={{fontSize: 13, fontWeight: 600, color: '#d4af37', fontFamily: FONTS.body}}>
              {carriesLabel}
            </span>
          </div>
        )}

        <span style={{fontSize: 13, color: '#90a1b9', fontFamily: FONTS.body}}>Loading next pair...</span>
      </div>
    </div>
  );
}
