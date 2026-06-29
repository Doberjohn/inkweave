import './reveals.css';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {INK_COLORS, FONTS} from '../../shared/constants';
import {InkIcon} from '../../shared/components/InkIcon';
import {CardMosaic} from './CardMosaic';
import {RarityBreakdown} from './RarityBreakdown';
import {PER_INK} from './setComposition';
import {inkRgba} from './inkTint';
import type {InkProgress} from './useRevealProgress';

interface InkBoardProps {
  progress: InkProgress;
  /** Opens the card modal when a revealed slot is clicked. */
  onOpen?: (card: LorcanaCard) => void;
  /** Mobile sizing. */
  compact?: boolean;
}

/**
 * The board header: a floating ink badge, the "INK BOARD" eyebrow + ink name, and
 * the `count / 34` with a "COLOR COMPLETE" ribbon at full. Held to its own
 * component so its `compact`/`done` branches don't pile onto InkBoard.
 */
function BoardHeader({ink, count, compact}: {ink: Ink; count: number; compact: boolean}) {
  const done = count >= PER_INK[ink];
  const inkText = INK_COLORS[ink].text;
  const badgeSize = compact ? 52 : 70;
  const symbolSize = compact ? 32 : 44;

  return (
    <div style={{display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap'}}>
      <div
        style={{
          width: badgeSize,
          height: badgeSize,
          borderRadius: compact ? 13 : 16,
          flex: '0 0 auto',
          background: `radial-gradient(circle at 50% 35%, ${inkRgba(ink, 0.28)}, rgba(10, 10, 16, 0.6))`,
          border: `1px solid ${inkRgba(ink, 0.5)}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: `0 0 26px ${inkRgba(ink, 0.3)}`,
        }}
      >
        <span
          className="reveal-anim"
          style={{
            lineHeight: 0,
            filter: `drop-shadow(0 2px 8px ${inkRgba(ink, 0.7)})`,
            animation: 'reveal-floatY 4s ease-in-out infinite',
          }}
        >
          <InkIcon ink={ink} size={symbolSize} />
        </span>
      </div>

      <div>
        <div style={{fontWeight: 600, fontSize: 11, letterSpacing: 2.4, textTransform: 'uppercase', color: inkText}}>
          Ink board
        </div>
        <div style={{fontFamily: FONTS.hero, fontWeight: 700, fontSize: compact ? 24 : 32, color: '#f0f0f5', lineHeight: 1.05, marginTop: 3}}>
          {ink}
        </div>
      </div>

      <div style={{marginLeft: 'auto', textAlign: 'right'}}>
        <div style={{fontWeight: 800, fontSize: compact ? 28 : 38, color: '#f5d877', lineHeight: 1}}>
          {count}
          <span style={{fontSize: compact ? 14 : 19, fontWeight: 700, color: '#666680'}}> / {PER_INK[ink]}</span>
        </div>
        {done ? (
          <div
            className="reveal-anim"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 8,
              fontWeight: 700,
              fontSize: 11,
              letterSpacing: 1.4,
              textTransform: 'uppercase',
              color: '#0d0d14',
              padding: '5px 14px',
              borderRadius: 20,
              background: 'linear-gradient(90deg, #d4af37, #f5d877, #d4af37)',
              backgroundSize: '200% 100%',
              animation: 'reveal-ribbonShine 2.4s linear infinite',
            }}
          >
            Color complete
          </div>
        ) : (
          <div style={{fontWeight: 500, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase', color: '#90a1b9', marginTop: 9}}>
            Revealed so far
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * The featured board for one ink: a header (badge + name + count, with a
 * "COLOR COMPLETE" ribbon at 34), the diamond mosaic, and the rarity breakdown.
 * The panel glow and the bloom behind the header both scale with fill (count/34),
 * so a fuller board visibly radiates more.
 */
export function InkBoard({progress, onOpen, compact = false}: InkBoardProps) {
  const {ink, count, cards, rarityCounts} = progress;
  const fill = count / PER_INK[ink];

  return (
    <div
      style={{
        position: 'relative',
        background: '#0a0a12',
        border: `1px solid ${inkRgba(ink, 0.28)}`,
        borderRadius: compact ? 16 : 18,
        padding: compact ? '18px 16px' : '26px 30px 24px',
        overflow: 'hidden',
        boxShadow: `0 18px 60px rgba(0, 0, 0, 0.5), 0 0 ${30 + fill * 60}px ${inkRgba(ink, 0.06 + fill * 0.16)}`,
      }}
    >
      {/* Radial bloom behind the header; intensity scales with fill. */}
      <div
        style={{
          position: 'absolute',
          top: '-30%',
          left: '50%',
          width: '70%',
          height: '60%',
          transform: 'translateX(-50%)',
          background: `radial-gradient(circle, ${inkRgba(ink, 0.1 + fill * 0.14)}, transparent 70%)`,
          pointerEvents: 'none',
        }}
      />

      <div style={{position: 'relative'}}>
        <BoardHeader ink={ink} count={count} compact={compact} />

        <div style={{marginTop: 22}}>
          {/* key={ink} re-mounts the mosaic on each color switch so a fresh set of
              random slots bursts in (see CardMosaic's pop logic). */}
          <CardMosaic key={ink} ink={ink} cards={cards} onOpen={onOpen} compact={compact} />
        </div>

        <RarityBreakdown rarityCounts={rarityCounts} compact={compact} />
      </div>
    </div>
  );
}
