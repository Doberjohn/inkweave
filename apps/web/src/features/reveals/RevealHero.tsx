import type {CSSProperties} from 'react';
import {SET_TOTAL} from './setComposition';
import type {CountdownMilestone, CountdownState} from './useCountdown';
import {COLORS, REVEAL_SET_CODE, REVEAL_SET_LOGO, SET_NAMES} from '../../shared/constants';

interface RevealHeroProps {
  /** Days to the pre-release, then to the store release; null while the reveal dates load. */
  countdown: CountdownState | null;
  /** Formatted release date, e.g. "July 24, 2026". */
  releaseDate: string;
  /** Unique cards revealed so far. */
  totalRevealed: number;
  /** New franchises this set. */
  franchiseCount: number;
  /** Total cards in the set (denominator). */
  totalCards?: number;
  compact?: boolean;
}

/** The label under the debut-franchise count, singular for a one-franchise set. */
function franchiseLabel(count: number): string {
  return count === 1 ? 'New franchise' : 'New franchises';
}

const COUNTDOWN_LABELS: Record<CountdownMilestone, string> = {
  'pre-release': 'Until pre-release',
  'store-release': 'Until store release',
};

/** Stands in, unseen, until the reveal dates load. */
const LOADING_COUNTDOWN: CountdownState = {days: 0, milestone: 'pre-release'};

interface CountdownPanelProps {
  countdown: CountdownState | null;
  releaseDate: string;
  compact: boolean;
  bigStat: CSSProperties;
  unitStyle: CSSProperties;
  labelStyle: CSSProperties;
}

/**
 * The gold panel: the countdown beside the set's release date. While the dates load the
 * countdown is hidden rather than removed, so the panel keeps its size.
 */
function CountdownPanel({
  countdown,
  releaseDate,
  compact,
  bigStat,
  unitStyle,
  labelStyle,
}: CountdownPanelProps) {
  const {days, milestone} = countdown ?? LOADING_COUNTDOWN;
  const unit = days === 1 ? 'day' : 'days';
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-end',
        gap: 16,
        background: 'rgba(212, 175, 55, 0.06)',
        border: '1px solid rgba(212, 175, 55, 0.28)',
        borderRadius: 14,
        // Narrower sides on phones keep the label and the date from wrapping at 360px.
        padding: compact ? 16 : '16px 24px',
        boxShadow: '0 0 24px rgba(212, 175, 55, 0.06)',
      }}
    >
      <div style={{textAlign: 'left', visibility: countdown ? 'visible' : 'hidden'}}>
        <div style={{...bigStat, color: '#f5d877'}}>
          {days}
          <span style={{...unitStyle, color: '#d4af37', letterSpacing: 0.5}}> {unit}</span>
        </div>
        <div style={labelStyle}>{COUNTDOWN_LABELS[milestone]}</div>
      </div>
      <div style={{width: 1, height: 40, background: '#3a3a52'}} />
      <div style={{textAlign: 'left'}}>
        <div style={{fontWeight: 700, fontSize: 18, color: '#e8e8e8', lineHeight: 1.2}}>{releaseDate}</div>
        <div style={labelStyle}>Set release</div>
      </div>
    </div>
  );
}

/**
 * The reveals page header: the set logo over two stat panels (a gold countdown
 * panel and a neutral revealed/franchises panel). Deliberately minimal — no
 * intro copy or progress bar; the six trackers below carry the progress story.
 */
export function RevealHero({
  countdown,
  releaseDate,
  totalRevealed,
  franchiseCount,
  totalCards = SET_TOTAL,
  compact = false,
}: RevealHeroProps) {
  const labelStyle = {
    fontWeight: 500,
    fontSize: compact ? 9 : 11,
    letterSpacing: 1.4,
    textTransform: 'uppercase' as const,
    color: '#90a1b9',
    marginTop: 5,
  };
  const bigStat = {fontWeight: 700, fontSize: compact ? 24 : 30, lineHeight: 1};
  /** The small unit suffix riding beside a big stat ("days", "/ 204"). */
  const unitStyle = {fontSize: compact ? 12 : 15, fontWeight: 600};

  return (
    <header style={{textAlign: 'center', padding: compact ? '24px 16px 8px' : '40px 36px 12px'}}>
      <img
        src={REVEAL_SET_LOGO}
        alt={SET_NAMES[REVEAL_SET_CODE]}
        style={{
          maxWidth: compact ? 240 : 300,
          width: '100%',
          height: 'auto',
          display: 'block',
          margin: '0 auto',
          filter: 'drop-shadow(0 0 30px rgba(173, 70, 255, 0.25))',
        }}
      />

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'center',
          gap: compact ? 8 : 14,
          marginTop: compact ? 18 : 30,
        }}
      >
        <CountdownPanel
          countdown={countdown}
          releaseDate={releaseDate}
          compact={compact}
          bigStat={bigStat}
          unitStyle={unitStyle}
          labelStyle={labelStyle}
        />

        {/* Revealed + franchises panel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'stretch',
            background: 'rgba(255, 255, 255, 0.025)',
            border: '1px solid #2a2a40',
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <div style={{padding: '16px 22px', textAlign: 'left'}}>
            <div style={{...bigStat, color: '#e8e8e8'}}>
              {totalRevealed}
              {/* textMuted, not textDim: textDim gives 3.3:1 on the hero, under the 4.5:1 WCAG asks. */}
              <span style={{...unitStyle, color: COLORS.textMuted}}> / {totalCards}</span>
            </div>
            <div style={labelStyle}>Cards revealed</div>
          </div>
          <div style={{padding: '16px 22px', textAlign: 'left', borderLeft: '1px solid #2a2a40'}}>
            <div style={{...bigStat, color: '#c4a5f5'}}>{franchiseCount}</div>
            <div style={labelStyle}>{franchiseLabel(franchiseCount)}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
