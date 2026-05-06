import {useState, useEffect} from 'react';
import {COLORS, EASING, FONT_SIZES} from '../../../shared/constants';

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

const LABELS = {
  lower: 'Should be lower',
  right: 'Score is fair',
  higher: 'Should be higher',
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
            style={{
              flex: animate ? undefined : pct[key],
              width: animate ? (mounted ? `${pct[key]}%` : '0%') : undefined,
              background: SEGMENT_COLORS[key].bg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: `${FONT_SIZES.xs}px`,
              color: SEGMENT_COLORS[key].text,
              fontWeight: 600,
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
            }}>
            {pct[key]}%
          </div>
        ))}
      </div>
      {showLabels && (
        <div
          style={{
            // Same flex layout + gap as the bar above so each label tracks its segment's width
            // and stays centered under it (mockup phase 2 dist-labels, with zero-count labels dropped).
            display: 'flex',
            gap: 2,
            marginTop: 6,
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.04em',
          }}>
          {segments.map((key) => (
            <span
              key={key}
              style={{
                flex: pct[key],
                color: SEGMENT_COLORS[key].text,
                textAlign: 'center',
              }}>
              {LABELS[key]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
