import {useEffect, useRef, useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SHADOWS, TIER_COLORS, Z_INDEX} from '../../../shared/constants';
import {LinkButton} from '../../../shared/components/LinkButton';
import type {Score} from '../../../shared/lib/supabase';
import {getStrengthTier} from '../../synergies/utils/scoreUtils';

export interface VoteToastData {
  cardAName: string;
  cardBName: string;
  userScore: Score;
  engineScore: number;
  streak?: number;
}

interface VoteToastProps {
  data: VoteToastData;
  onDismiss: () => void;
  onUndo?: () => void;
  isMobile?: boolean;
}

const DISMISS_MS = 3000;
const ENTER_MS = 300;

/** Inject keyframes once at module load. Must exist before first render. */
(function injectKeyframes() {
  const STYLE_ID = 'vote-toast-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes toast-enter {
      from { transform: translateX(-100%); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
    @keyframes toast-exit {
      from { transform: translateX(0); opacity: 1; }
      to   { transform: translateX(-100%); opacity: 0; }
    }
    @keyframes toast-progress {
      from { width: 100%; }
      to   { width: 0%; }
    }
  `;
  document.head.appendChild(style);
})();

function ScoreCircle({score, label}: {score: number; label: string}) {
  const tier = getStrengthTier(score);
  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
      <span style={{fontSize: FONT_SIZES.sm, color: COLORS.textMuted, fontFamily: FONTS.body}}>{label}</span>
      <div
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          background: tier.bg,
          border: `2px solid ${tier.color}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <span style={{fontSize: FONT_SIZES.base, fontWeight: 700, color: tier.color, fontFamily: FONTS.body}}>
          {score}
        </span>
      </div>
    </div>
  );
}

function getReaction(userScore: number, engineScore: number): {text: string; color: string} {
  const diff = Math.abs(userScore - engineScore);
  if (diff === 0) return {text: 'Exact match!', color: TIER_COLORS.perfect.color};
  if (diff <= 1) return {text: 'Close match!', color: TIER_COLORS.strong.color};
  if (diff >= 5) return {text: 'Hot take!', color: TIER_COLORS.weak.color};
  if (userScore > engineScore) return {text: 'You rated higher', color: TIER_COLORS.moderate.color};
  return {text: 'You rated lower', color: TIER_COLORS.weak.color};
}

export function VoteToast({data, onDismiss, onUndo, isMobile}: VoteToastProps) {
  const [exiting, setExiting] = useState(false);
  const [paused, setPaused] = useState(false);
  const startRef = useRef(0);
  const remainRef = useRef(DISMISS_MS);
  const timersRef = useRef<{dismiss?: ReturnType<typeof setTimeout>; remove?: ReturnType<typeof setTimeout>}>({});
  const onDismissRef = useRef(onDismiss);
  useEffect(() => { onDismissRef.current = onDismiss; }, [onDismiss]);

  const schedule = (ms: number) => {
    startRef.current = Date.now();
    remainRef.current = ms;
    timersRef.current.dismiss = setTimeout(() => setExiting(true), ms);
    timersRef.current.remove = setTimeout(() => onDismissRef.current(), ms + ENTER_MS);
  };

  useEffect(() => {
    schedule(DISMISS_MS);
    return () => {
      clearTimeout(timersRef.current.dismiss);
      clearTimeout(timersRef.current.remove);
    };
  }, [schedule]);

  const handleMouseEnter = () => {
    remainRef.current = Math.max(0, remainRef.current - (Date.now() - startRef.current));
    clearTimeout(timersRef.current.dismiss);
    clearTimeout(timersRef.current.remove);
    setPaused(true);
  };

  const handleMouseLeave = () => {
    setPaused(false);
    schedule(remainRef.current);
  };

  const reaction = getReaction(data.userScore, data.engineScore);

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        position: 'fixed',
        bottom: isMobile ? 120 : 20,
        left: 20,
        zIndex: Z_INDEX.toast,
        width: 'calc(100vw - 40px)',
        maxWidth: 340,
        borderRadius: RADIUS.card,
        background: COLORS.surface,
        border: `1px solid ${COLORS.surfaceBorder}`,
        boxShadow: SHADOWS.float,
        overflow: 'hidden',
        animation: exiting
          ? `toast-exit ${ENTER_MS}ms ease-in forwards`
          : `toast-enter ${ENTER_MS}ms ease-out`,
      }}>
      <div style={{padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 8}}>
        {/* Header */}
        <div style={{display: 'flex', alignItems: 'center', gap: 8}}>
          <span style={{color: TIER_COLORS.strong.color, fontSize: FONT_SIZES.lg, fontWeight: 700}}>✓</span>
          <span style={{fontSize: FONT_SIZES.base, fontWeight: 600, color: COLORS.text, fontFamily: FONTS.body}}>
            Vote submitted
          </span>
          {onUndo && (
            <LinkButton onClick={onUndo} style={{marginLeft: 'auto', padding: '2px 6px'}}>
              Undo
            </LinkButton>
          )}
        </div>

        {/* Pair names */}
        <span
          style={{
            fontSize: FONT_SIZES.sm,
            color: COLORS.textMuted,
            fontFamily: FONTS.body,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}>
          {data.cardAName} + {data.cardBName}
        </span>

        {/* Score comparison */}
        <div style={{display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap'}}>
          <ScoreCircle score={data.userScore} label="You:" />
          <span style={{fontSize: FONT_SIZES.sm, color: COLORS.textMuted, fontFamily: FONTS.body, fontStyle: 'italic'}}>vs</span>
          <ScoreCircle score={data.engineScore} label="Engine:" />
          <span style={{fontSize: FONT_SIZES.sm, fontWeight: 600, color: reaction.color, fontFamily: FONTS.body, marginLeft: 'auto'}}>
            {data.streak && data.streak >= 2
              ? `${reaction.text} · ${data.streak} in a row!`
              : reaction.text}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div style={{height: 3, background: COLORS.surfaceBorder}}>
        <div
          style={{
            height: '100%',
            background: `linear-gradient(90deg, ${COLORS.primary500}, ${COLORS.primary})`,
            borderRadius: RADIUS.xs,
            animation: `toast-progress ${DISMISS_MS}ms linear forwards`,
            animationPlayState: paused ? 'paused' : 'running',
          }}
        />
      </div>
    </div>
  );
}
