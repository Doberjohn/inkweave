import {SET_TOTAL} from './setComposition';
import {REVEAL_SET_CODE, REVEAL_SET_LOGO, SET_NAMES} from '../../shared/constants';

interface RevealHeroProps {
  /** Days until pre-release. */
  countdownDays: number;
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

/**
 * The reveals page header: the set logo over two stat panels (a gold countdown
 * panel and a neutral revealed/franchises panel). Deliberately minimal — no
 * intro copy or progress bar; the six trackers below carry the progress story.
 */
export function RevealHero({
  countdownDays,
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
        {/* Countdown panel */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-end',
            gap: 16,
            background: 'rgba(212, 175, 55, 0.06)',
            border: '1px solid rgba(212, 175, 55, 0.28)',
            borderRadius: 14,
            padding: '16px 24px',
            boxShadow: '0 0 24px rgba(212, 175, 55, 0.06)',
          }}
        >
          <div style={{textAlign: 'left'}}>
            <div style={{...bigStat, color: '#f5d877'}}>
              {countdownDays}
              <span style={{fontSize: compact ? 12 : 15, fontWeight: 600, color: '#d4af37', letterSpacing: 0.5}}> days</span>
            </div>
            <div style={labelStyle}>Until pre-release</div>
          </div>
          <div style={{width: 1, height: 40, background: '#3a3a52'}} />
          <div style={{textAlign: 'left'}}>
            <div style={{fontWeight: 700, fontSize: 18, color: '#e8e8e8', lineHeight: 1.2}}>{releaseDate}</div>
            <div style={labelStyle}>Set release</div>
          </div>
        </div>

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
              <span style={{fontSize: compact ? 12 : 15, fontWeight: 600, color: '#666680'}}> / {totalCards}</span>
            </div>
            <div style={labelStyle}>Cards revealed</div>
          </div>
          <div style={{padding: '16px 22px', textAlign: 'left', borderLeft: '1px solid #2a2a40'}}>
            <div style={{...bigStat, color: '#c4a5f5'}}>{franchiseCount}</div>
            <div style={labelStyle}>{franchiseCount === 1 ? 'New franchise' : 'New franchises'}</div>
          </div>
        </div>
      </div>
    </header>
  );
}
