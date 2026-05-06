import {useState, useEffect} from 'react';
import {COLORS, EASING} from '../../../shared/constants';

interface DistributionBarProps {
  lower: number;
  right: number;
  higher: number;
  animate: boolean;
  showLabels?: boolean;
  /** Primary context line above the bar (mockup phase 2: "How the community rates Inkweave's score"). */
  contextLabel?: string;
}

const SEGMENT_COLORS = {
  lower: {bg: 'rgba(245, 144, 144, 0.25)', text: '#f59090'},
  right: {bg: 'rgba(110, 231, 160, 0.2)', text: '#6ee7a0'},
  higher: {bg: 'rgba(96, 181, 245, 0.2)', text: '#60b5f5'},
} as const;

// Short labels for the fixed legend below the bar. Solution B from the engine
// column equal-height work — the legend isn't segment-positioned, so labels
// never wrap regardless of percentage distribution.
const LEGEND_LABELS = {
  lower: 'Lower',
  right: 'Fair',
  higher: 'Higher',
} as const;

export function DistributionBar({lower, right, higher, animate, showLabels = true, contextLabel}: DistributionBarProps) {
  const total = lower + right + higher;
  const [mounted, setMounted] = useState(!animate);

  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);

  if (total === 0) return null;

  const pct = {
    lower: Math.round((lower / total) * 100),
    right: Math.round((right / total) * 100),
    higher: Math.round((higher / total) * 100),
  };

  // Fix rounding to sum to 100
  const diff = 100 - pct.lower - pct.right - pct.higher;
  if (diff !== 0) {
    const largest = Object.entries(pct).sort(([, a], [, b]) => b - a)[0][0] as keyof typeof pct;
    pct[largest] += diff;
  }

  const segments = (['lower', 'right', 'higher'] as const).filter((key) => pct[key] > 0);

  return (
    <div>
      {contextLabel && (
        <p
          style={{
            margin: '0 0 8px',
            fontSize: 11,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 500,
            textAlign: 'center',
          }}>
          {contextLabel}
        </p>
      )}
      <div
        style={{
          display: 'flex',
          height: 28,
          borderRadius: 6,
          overflow: 'hidden',
          gap: 2,
        }}>
        {segments.map((key, i) => (
          <div
            key={key}
            aria-label={`${LEGEND_LABELS[key]}: ${pct[key]}%`}
            style={{
              flex: animate ? undefined : pct[key],
              width: animate ? (mounted ? `${pct[key]}%` : '0%') : undefined,
              background: SEGMENT_COLORS[key].bg,
              borderRadius:
                i === 0 && segments.length > 1
                  ? '6px 0 0 6px'
                  : i === segments.length - 1 && segments.length > 1
                    ? '0 6px 6px 0'
                    : segments.length === 1
                      ? '6px'
                      : undefined,
              transition: animate ? `width 500ms ${EASING.smooth}` : undefined,
              transitionDelay: animate ? `${i * 50}ms` : undefined,
            }}
          />
        ))}
      </div>
      {showLabels && (
        <div
          style={{
            // Solution B: fixed legend below the bar. NOT segment-positioned, so labels
            // never wrap regardless of how narrow any segment is. Each entry: color dot
            // + short label + percentage. Centered as a single horizontal flex.
            display: 'flex',
            justifyContent: 'center',
            gap: 14,
            marginTop: 6,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
          {segments.map((key) => (
            <span
              key={key}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                color: SEGMENT_COLORS[key].text,
              }}>
              <span
                aria-hidden="true"
                style={{
                  width: 6,
                  height: 6,
                  borderRadius: '50%',
                  background: SEGMENT_COLORS[key].text,
                  flexShrink: 0,
                }}
              />
              <span>{`${LEGEND_LABELS[key]} ${pct[key]}%`}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
