import {useState} from 'react';
import {EASING, FONTS} from '../../../shared/constants';
import type {Score} from '../../../shared/lib/supabase';
import {getStrengthTier} from '../../synergies/utils/scoreUtils';

interface ScorePickerProps {
  value: Score | null;
  onChange: (score: Score) => void;
  isMobile?: boolean;
  /** Buttons flex to fill container width instead of using fixed sizes */
  responsive?: boolean;
}

/** Map a discrete 1-10 score to its strength tier visuals */
function getTierForScore(score: Score) {
  // getStrengthTier uses >=9.5 for Perfect, but our scores are integers.
  // Score 10 needs to be mapped into the Perfect threshold.
  return getStrengthTier(score >= 10 ? 9.5 : score);
}

/** Inject keyframes once at module load. Must exist before first render. */
(function injectKeyframes() {
  const STYLE_ID = 'score-picker-keyframes';
  if (typeof document === 'undefined' || document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    @keyframes score-pulse {
      0%   { transform: scale(1); }
      40%  { transform: scale(1.18); }
      100% { transform: scale(1); }
    }
    [aria-label^="Score"]:focus-visible {
      outline: 2px solid #d4af37;
      outline-offset: 2px;
    }
  `;
  document.head.appendChild(style);
})();

const TIER_GROUPS = [
  {scores: [1, 2, 3] as Score[], label: 'Weak'},
  {scores: [4, 5, 6] as Score[], label: 'Moderate'},
  {scores: [7, 8, 9] as Score[], label: 'Strong'},
  {scores: [10] as Score[], label: 'Perfect'},
];

/** Pair of tier groups rendered in a row */
const MOBILE_ROWS = [
  [TIER_GROUPS[0], TIER_GROUPS[1]], // Weak + Moderate
  [TIER_GROUPS[2], TIER_GROUPS[3]], // Strong + Perfect
];

export function ScorePicker({value, onChange, isMobile, responsive}: ScorePickerProps) {
  const size = isMobile ? 42 : 52;
  const fontSize = isMobile ? 14 : 16;
  const [hoveredScore, setHoveredScore] = useState<Score | null>(null);
  const [pulsingScore, setPulsingScore] = useState<Score | null>(null);

  const handleClick = (score: Score) => {
    setPulsingScore(score);
    onChange(score);
    setTimeout(() => setPulsingScore(null), 300);
  };

  const renderButton = (score: Score) => {
    const tier = getTierForScore(score);
    const isSelected = value === score;
    const isHovered = hoveredScore === score;
    const isPulsing = pulsingScore === score;
    return (
      <button
        key={score}
        role="radio"
        aria-checked={isSelected}
        aria-label={`Score ${score}`}
        onClick={() => handleClick(score)}
        onMouseEnter={() => setHoveredScore(score)}
        onMouseLeave={() => setHoveredScore(null)}
        style={{
          width: responsive ? 'auto' : size,
          height: responsive ? 'auto' : size,
          aspectRatio: responsive ? '1' : undefined,
          flex: responsive ? 1 : undefined,
          minWidth: responsive ? 0 : undefined,
          borderRadius: 8,
          border: `${isSelected ? 2 : 1}px solid ${tier.color}`,
          background: tier.bg,
          color: tier.color,
          fontSize,
          fontWeight: isSelected ? 700 : 600,
          fontFamily: FONTS.body,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: isSelected
            ? `0 0 14px ${tier.color}66`
            : isHovered
              ? `0 0 10px ${tier.color}33`
              : 'none',
          transform: isHovered && !isPulsing ? 'scale(1.1)' : 'scale(1)',
          transition: `box-shadow 0.3s ${EASING.bounce}, border-width 0.2s ${EASING.snappy}, transform 0.3s ${EASING.bounce}`,
          animation: isPulsing ? 'score-pulse 0.3s ease-out' : 'none',
          padding: 0,
        }}>
        {score}
      </button>
    );
  };

  const renderGroup = (group: typeof TIER_GROUPS[number]) => {
    const tier = getTierForScore(group.scores[0]);
    return (
      <div key={group.label} style={{display: 'flex', flexDirection: 'column', alignItems: responsive ? 'stretch' : 'center', gap: 4, flex: responsive ? group.scores.length : undefined, minWidth: responsive ? 0 : undefined}}>
        <div style={{display: 'flex', gap: 4}}>
          {group.scores.map(renderButton)}
        </div>
        <span style={{fontSize: 10, color: tier.color, fontFamily: FONTS.body, letterSpacing: '0.04em', textAlign: 'center'}}>
          {group.label}
        </span>
      </div>
    );
  };

  if (isMobile) {
    return (
      <div
        role="radiogroup"
        aria-label="Synergy score"
        style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10}}>
        {MOBILE_ROWS.map((row, i) => (
          <div key={i} style={{display: 'flex', justifyContent: 'center', gap: 16}}>
            {row.map(renderGroup)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      role="radiogroup"
      aria-label="Synergy score"
      style={{display: 'flex', justifyContent: 'center', gap: 16}}>
      {TIER_GROUPS.map(renderGroup)}
    </div>
  );
}
