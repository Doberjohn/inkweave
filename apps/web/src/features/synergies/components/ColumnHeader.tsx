import type {ReactNode} from 'react';
import {Tooltip} from '../../../shared/components';
import {COLORS, FONTS, SPACING} from '../../../shared/constants';

interface ColumnHeaderProps {
  title: string;
  accentColor: string;
  score: string;
  scoreColor: string;
  scoreFontSize: number;
  showScale: boolean;
  meta: ReactNode;
  /** Optional tooltip-shown ("?" info button next to score). Used by EngineColumn for tier explainer. */
  scoreTooltip?: string;
  /**
   * When set, the score span gets `className="engine-score-pulse-on-entry"` (a 460ms brightness +
   * drop-shadow pulse that fires ~1180ms after mount, just as the PairConnector finishes drawing).
   * The value is used as a React `key` on the score span so pair-switching remounts it and
   * restarts the animation. EngineColumn passes a pair-id signature; CommunityColumn leaves it
   * undefined (community score has no connector-landing event to celebrate).
   */
  pulseScoreKey?: string;
}

export function ColumnHeader({title, accentColor, score, scoreColor, scoreFontSize, showScale, meta, scoreTooltip, pulseScoreKey}: ColumnHeaderProps) {
  return (
    <header style={HEADER_STYLE}>
      <h3 style={{...TITLE_STYLE, color: accentColor}}>{title}</h3>
      <ScoreStats
        score={score}
        scoreColor={scoreColor}
        scoreFontSize={scoreFontSize}
        showScale={showScale}
        scoreTooltip={scoreTooltip}
        meta={meta}
        pulseScoreKey={pulseScoreKey}
      />
      <HeaderDivider accentColor={accentColor} />
    </header>
  );
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr auto 1fr',
  alignItems: 'center',
  // Lock to the engine column's natural max (87px) so engine + community ColumnHeader heights
  // are deterministic and identical. Engine sits at ~87 today; community at 81-86 expands to fill.
  minHeight: 87,
  marginBottom: SPACING.section,
  paddingBottom: SPACING.section,
  position: 'relative',
};

const TITLE_STYLE: React.CSSProperties = {
  gridColumn: 2,
  margin: 0,
  // Match the modal h1 (card name) treatment: Plus Jakarta Sans, 22px / 700. Bigger than the
  // mockup's 17px — column titles are the second most important readout in focused state.
  fontFamily: FONTS.body,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: '0.02em',
  textAlign: 'center',
  lineHeight: 1.15,
};

interface ScoreStatsProps {
  score: string;
  scoreColor: string;
  scoreFontSize: number;
  showScale: boolean;
  scoreTooltip?: string;
  meta: ReactNode;
  pulseScoreKey?: string;
}

function ScoreStats({score, scoreColor, scoreFontSize, showScale, scoreTooltip, meta, pulseScoreKey}: ScoreStatsProps) {
  const scoreStyle: React.CSSProperties = {fontWeight: 700, fontSize: scoreFontSize, color: scoreColor, lineHeight: 1};
  return (
    <div
      style={{
        gridColumn: 3,
        justifySelf: 'end',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-end',
        // Mockup phase 2 `.score-col-stats { gap: 8px }` — sets the score-line vs meta-line spacing.
        gap: 8,
      }}>
      <div style={{display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap'}}>
        {pulseScoreKey ? (
          <span key={pulseScoreKey} className="engine-score-pulse-on-entry" style={scoreStyle}>
            {score}
          </span>
        ) : (
          <span style={scoreStyle}>{score}</span>
        )}
        {showScale && (
          <span style={{fontSize: 14, fontWeight: 600, color: COLORS.textMuted, marginLeft: 2}}>/ 10</span>
        )}
        {scoreTooltip && <ScoreTooltipButton content={scoreTooltip} />}
      </div>
      <div style={META_STYLE}>{meta}</div>
    </div>
  );
}

const META_STYLE: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  whiteSpace: 'nowrap',
  color: COLORS.textMuted,
};

function ScoreTooltipButton({content}: {content: string}) {
  return (
    <Tooltip content={content} triggerStyle={{alignSelf: 'center', marginLeft: 6}}>
      <button
        type="button"
        aria-label="What does this score mean?"
        style={{
          width: 18,
          height: 18,
          borderRadius: '50%',
          background: 'rgba(212, 175, 55, 0.06)',
          border: '1px solid rgba(212, 175, 55, 0.3)',
          color: 'rgba(212, 175, 55, 0.85)',
          fontSize: 11,
          fontWeight: 700,
          cursor: 'help',
          fontFamily: 'inherit',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          lineHeight: 1,
          padding: 0,
        }}>
        ?
      </button>
    </Tooltip>
  );
}

/** Bottom gradient divider, absolutely positioned so it doesn't take grid-row height. */
function HeaderDivider({accentColor}: {accentColor: string}) {
  return (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 1,
        background: `linear-gradient(90deg, transparent, ${accentColor} 50%, transparent)`,
      }}
    />
  );
}
