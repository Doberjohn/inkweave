import {useEffect, useRef, useState} from 'react';
import {COLORS, FONTS, SPACING} from '../../../shared/constants';
import {getStrengthTier} from '../../synergies/utils/scoreUtils';
import type {Score} from '../../../shared/lib/supabase';
import type {VotingPair} from '../types';
import type {PairPreview} from '../hooks/usePairQueue';
import {VotingCardDisplay} from './VotingCardDisplay';
import {PairStack} from './PairStack';
import {ConnectionGroup, groupConnections} from '../../../shared/components';

const TRANSITION_MS = 450;

/** Half-width offset from center where the previous/upcoming stacks begin (px) */
const STACK_OFFSET_PX = 440;

/** Inject carousel keyframes at module load */
(function injectPairKeyframes() {
  const STYLE_ID = 'pair-transition-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes pair-exit-left {
      from { transform: translateX(0) scale(1); opacity: 1; }
      to   { transform: translateX(-420px) scale(0.55); opacity: 0.3; }
    }
    @keyframes pair-enter-right {
      from { transform: translateX(420px) scale(0.55); opacity: 0.3; }
      to   { transform: translateX(0) scale(1); opacity: 1; }
    }
    @keyframes pair-slide-in {
      from { transform: translateX(80px); opacity: 0; }
      to   { transform: translateX(0); opacity: 1; }
    }
    @keyframes mystery-pulse {
      0%, 100% { box-shadow: 0 0 20px 2px rgba(212, 175, 55, 0.35); transform: scale(1); }
      50%      { box-shadow: 0 0 28px 6px rgba(212, 175, 55, 0.55); transform: scale(1.08); }
    }
  `;
  document.head.appendChild(style);
})();

interface PairDisplayProps {
  pair: VotingPair;
  selectedScore: Score | null;
  previousPairs?: PairPreview[];
  upcomingPairs?: PairPreview[];
  isMobile?: boolean;
  /** Show the engine's aggregate score in the badge instead of "?" */
  showEngineScore?: boolean;
}

/** Dashed SVG line between card and score badge */
function DashedLine({width, muted}: {width: number; muted?: boolean}) {
  return (
    <svg width={width} height={2} style={{flexShrink: 0}}>
      <line
        x1={0}
        y1={1}
        x2={width}
        y2={1}
        stroke={muted ? '#555577' : '#333355'}
        strokeWidth={2}
        strokeDasharray="6 4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Gold mystery badge (?) — shows pulsing "?" when no score, tier-colored score when selected */
function MysteryBadge({selectedScore, size}: {selectedScore: Score | null; size: number}) {
  const tier = selectedScore !== null ? getStrengthTier(selectedScore) : null;

  const color = tier?.color ?? COLORS.primary500;
  const bg = tier?.bg ?? '#1a1a0a';
  const glowColor = tier ? `${color}59` : 'rgba(212, 175, 55, 0.35)';
  const textGlow = tier ? `0 0 12px ${color}99` : '0 0 12px rgba(255, 185, 0, 0.6)';

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        background: bg,
        border: `2px solid ${color}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        boxShadow: `0 0 20px 2px ${glowColor}`,
        animation: tier ? 'none' : 'mystery-pulse 3s ease-in-out infinite',
        transition: 'all 0.3s ease',
      }}>
      <span
        style={{
          fontSize: size > 40 ? 20 : 16,
          fontWeight: 700,
          color,
          fontFamily: FONTS.body,
          textShadow: textGlow,
        }}>
        {selectedScore ?? '?'}
      </span>
    </div>
  );
}

/** Renders a pair of cards with dashed connector and mystery badge */
function PairRow({pair, selectedScore, size, highlightedCard}: {pair: VotingPair; selectedScore: Score | null; size: 'desktop' | 'mobile'; highlightedCard?: 'a' | 'b' | null}) {
  const isMobile = size === 'mobile';
  if (isMobile) {
    return (
      <div style={{display: 'flex', alignItems: 'start', justifyContent: 'center', width: '100%', gap: 0}}>
        <VotingCardDisplay card={pair.cardA} isMobile highlighted={highlightedCard === 'a'} dimmed={highlightedCard === 'b'} />
        <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', paddingTop: 72, flexShrink: 0}}>
          <div style={{display: 'flex', alignItems: 'center', gap: 4}}>
            <DashedLine width={16} muted />
            <MysteryBadge selectedScore={selectedScore} size={36} />
            <DashedLine width={16} muted />
          </div>
        </div>
        <VotingCardDisplay card={pair.cardB} isMobile highlighted={highlightedCard === 'b'} dimmed={highlightedCard === 'a'} />
      </div>
    );
  }
  return (
    <>
      <VotingCardDisplay card={pair.cardA} highlighted={highlightedCard === 'a'} dimmed={highlightedCard === 'b'} />
      <DashedLine width={40} />
      <MysteryBadge selectedScore={selectedScore} size={48} />
      <DashedLine width={40} />
      <VotingCardDisplay card={pair.cardB} highlighted={highlightedCard === 'b'} dimmed={highlightedCard === 'a'} />
    </>
  );
}

/** Renders grouped connections using the shared ConnectionGroup component */
function SynergyDescriptionGroups({pair, onHighlight}: {pair: VotingPair; onHighlight: (card: 'a' | 'b' | null) => void}) {
  const groups = groupConnections(pair.connections);
  if (groups.length === 0) return null;

  return (
    <div style={{width: '100%', maxWidth: 760, display: 'flex', flexDirection: 'column', gap: `${SPACING.sm}px`}}>
      {groups.map((group) => (
        <ConnectionGroup
          key={group.key}
          group={group}
          cardA={pair.cardA}
          cardB={pair.cardB}
          showScoreBadge={false}
          onHighlight={onHighlight}
        />
      ))}
    </div>
  );
}

const GHOST_TIERS = [
  {w: 132, h: 184, gap: 12, tilt: -3, opacity: 0.25, radius: 8},
  {w: 96, h: 134, gap: 8, tilt: -7, opacity: 0.15, radius: 6},
  {w: 67, h: 94, gap: 6, tilt: -11, opacity: 0.08, radius: 4},
];

/** Renders previous pairs stack with ghost silhouettes for unfilled tiers */
function PreviousStack({pairs}: {pairs: PairPreview[]}) {
  const realCount = Math.min(pairs.length, 3);
  const ghostTiers = GHOST_TIERS.slice(realCount);

  return (
    <div style={{display: 'flex', flexDirection: 'row-reverse', alignItems: 'center', gap: 48, pointerEvents: 'none'}}>
      {/* Real pairs rendered by PairStack */}
      {realCount > 0 && <PairStack pairs={pairs} side="left" />}
      {/* Ghost silhouettes for remaining tiers */}
      {ghostTiers.map((tier, i) => (
        <div key={`ghost-${realCount + i}`} style={{display: 'flex', gap: tier.gap, transform: `rotate(${tier.tilt}deg)`, opacity: tier.opacity}}>
          <div style={{width: tier.w, height: tier.h, borderRadius: tier.radius, border: '1px dashed #555577', background: '#12121f'}} />
          <div style={{width: tier.w, height: tier.h, borderRadius: tier.radius, border: '1px dashed #555577', background: '#12121f'}} />
        </div>
      ))}
    </div>
  );
}

export function PairDisplay({pair, selectedScore, previousPairs, upcomingPairs, isMobile, showEngineScore}: PairDisplayProps) {
  // In in-depth mode, show the engine's aggregate score instead of "?"
  const badgeScore = selectedScore ?? (showEngineScore ? Math.round(pair.aggregateScore) as Score : null);
  const pairId = `${pair.cardA.id}:${pair.cardB.id}`;
  const prevPairRef = useRef<VotingPair | null>(null);
  const prevPairIdRef = useRef(pairId);
  const [exitingPair, setExitingPair] = useState<VotingPair | null>(null);
  const [highlightedCard, setHighlightedCard] = useState<'a' | 'b' | null>(null);
  const isTransitioning = exitingPair !== null;

  // Detect pair change → trigger carousel transition
  useEffect(() => {
    if (pairId !== prevPairIdRef.current && prevPairRef.current) {
      setExitingPair(prevPairRef.current);
      prevPairIdRef.current = pairId;
      const timer = setTimeout(() => setExitingPair(null), TRANSITION_MS);
      return () => clearTimeout(timer);
    }
    prevPairIdRef.current = pairId;
  }, [pairId]);

  // Always track current pair for next transition
  useEffect(() => {
    prevPairRef.current = pair;
  });

  if (isMobile) {
    return (
      <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%', overflow: 'hidden'}}>
        <div
          key={pairId}
          style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, width: '100%',
            animation: 'pair-slide-in 400ms ease-out',
          }}>
          <PairRow pair={pair} selectedScore={badgeScore} size="mobile" />
          <SynergyDescriptionGroups pair={pair} onHighlight={() => {}} />
        </div>
      </div>
    );
  }

  return (
    <div style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: '100%'}}>
      {/* Cards row with carousel transition */}
      <div style={{position: 'relative', width: '100%', overflow: 'hidden', padding: '20px 0'}}>
        {/* Exiting pair — slides left and shrinks toward previous stack */}
        {exitingPair && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              zIndex: 1,
              pointerEvents: 'none',
            }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 0,
                animation: `pair-exit-left ${TRANSITION_MS}ms ease-in forwards`,
              }}>
              <PairRow pair={exitingPair} selectedScore={null} size="desktop" />
            </div>
          </div>
        )}

        {/* Active pair — slides in from right stack position */}
        <div
          key={pairId}
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 0,
            zIndex: 2,
            animation: isTransitioning
              ? `pair-enter-right ${TRANSITION_MS}ms ease-out`
              : 'none',
          }}>
          <PairRow pair={pair} selectedScore={badgeScore} size="desktop" highlightedCard={highlightedCard} />
        </div>

        {/* Previous pairs stack + ghost silhouettes (only when stacks are enabled) */}
        {previousPairs && (
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: 0, right: `calc(50% + ${STACK_OFFSET_PX}px)`,
            display: 'flex', justifyContent: 'flex-end', overflow: 'hidden',
          }}>
            <PreviousStack pairs={previousPairs} />
          </div>
        )}
        {/* Upcoming pairs stack */}
        {upcomingPairs && upcomingPairs.length > 0 && (
          <div style={{
            position: 'absolute', top: '50%', transform: 'translateY(-50%)',
            left: `calc(50% + ${STACK_OFFSET_PX}px)`, right: 0,
            display: 'flex', justifyContent: 'flex-start', overflow: 'hidden',
          }}>
            <PairStack pairs={upcomingPairs} side="right" />
          </div>
        )}
      </div>

      <SynergyDescriptionGroups pair={pair} onHighlight={setHighlightedCard} />
    </div>
  );
}
