import type {Ink} from 'inkweave-synergy-engine';
import {InkIcon} from '../../shared/components/InkIcon';
import {PER_INK} from './setComposition';
import {inkRgb, inkRgba} from './inkTint';

interface ProgressRingProps {
  ink: Ink;
  /** Revealed count for this ink. */
  count: number;
  /** Denominator (defaults to the per-ink board size). */
  total?: number;
  /** Outer diameter in px — 82 on desktop, 64 on mobile. */
  size?: number;
}

/**
 * Circular progress ring for an ink: a conic sweep filled to `count/total`,
 * masked to a thin ring, with the ink symbol over the count in the centre. The
 * sweep starts at 12 o'clock (`from -90deg`) and the glow tracks the ink colour.
 */
export function ProgressRing({ink, count, total = PER_INK, size = 82}: ProgressRingProps) {
  const pct = Math.max(0, Math.min(1, count / total));
  const deg = pct * 360;
  const rgb = inkRgb(ink);
  const symbolSize = Math.round(size * 0.32);
  const countFontSize = size >= 76 ? 14 : 12;

  return (
    <div style={{position: 'relative', width: size, height: size}}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: `conic-gradient(from -90deg, rgb(${rgb}) 0deg ${deg}deg, ${inkRgba(ink, 0.13)} ${deg}deg 360deg)`,
          WebkitMask: 'radial-gradient(closest-side, transparent 72%, #000 73%)',
          mask: 'radial-gradient(closest-side, transparent 72%, #000 73%)',
          filter: `drop-shadow(0 0 7px ${inkRgba(ink, 0.45)})`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 3,
        }}
      >
        <span style={{lineHeight: 0, opacity: 0.92, filter: `drop-shadow(0 1px 4px ${inkRgba(ink, 0.6)})`}}>
          <InkIcon ink={ink} size={symbolSize} />
        </span>
        <span style={{fontWeight: 700, fontSize: countFontSize, color: '#e8e8e8', lineHeight: 1}}>
          {count}
        </span>
      </div>
    </div>
  );
}
