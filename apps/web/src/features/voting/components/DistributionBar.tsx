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

type SegmentKey = 'lower' | 'right' | 'higher';

export function DistributionBar({lower, right, higher, animate, showLabels = true, contextLabel}: DistributionBarProps) {
  const total = lower + right + higher;
  const mounted = useMountedFlag(animate);

  if (total === 0) return null;

  const pct = computeRoundedPercents({lower, right, higher, total});
  const segments = (['lower', 'right', 'higher'] as const).filter((key) => pct[key] > 0);

  return (
    <div>
      <ContextLine label={contextLabel} />
      <div style={BAR_STYLE}>
        {segments.map((key, i) => (
          <DistributionSegment
            key={key}
            segmentKey={key}
            pct={pct[key]}
            index={i}
            segmentCount={segments.length}
            animate={animate}
            mounted={mounted}
          />
        ))}
      </div>
      {showLabels && <DistributionLegend segments={segments} pct={pct} />}
    </div>
  );
}

const BAR_STYLE: React.CSSProperties = {
  display: 'flex',
  height: 28,
  borderRadius: 6,
  overflow: 'hidden',
  gap: 2,
};

/** Defers the mount flag by one rAF when animate=true so segment widths transition from 0 → pct. */
function useMountedFlag(animate: boolean): boolean {
  const [mounted, setMounted] = useState(!animate);
  useEffect(() => {
    if (!animate) return;
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, [animate]);
  return mounted;
}

interface ComputeRoundedPercentsInput {
  lower: number;
  right: number;
  higher: number;
  total: number;
}

/** Round-and-correct percents so they sum to exactly 100 (largest segment absorbs the rounding diff). */
function computeRoundedPercents({lower, right, higher, total}: ComputeRoundedPercentsInput) {
  const pct = {
    lower: Math.round((lower / total) * 100),
    right: Math.round((right / total) * 100),
    higher: Math.round((higher / total) * 100),
  };
  const diff = 100 - pct.lower - pct.right - pct.higher;
  if (diff === 0) return pct;
  const largest = Object.entries(pct).sort(([, a], [, b]) => b - a)[0][0] as SegmentKey;
  pct[largest] += diff;
  return pct;
}

function ContextLine({label}: {label: string | undefined}) {
  if (!label) return null;
  return (
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
      {label}
    </p>
  );
}

interface DistributionSegmentProps {
  segmentKey: SegmentKey;
  pct: number;
  index: number;
  segmentCount: number;
  animate: boolean;
  mounted: boolean;
}

function DistributionSegment({segmentKey, pct, index, segmentCount, animate, mounted}: DistributionSegmentProps) {
  return (
    <div
      aria-label={`${LEGEND_LABELS[segmentKey]}: ${pct}%`}
      style={{
        flex: animate ? undefined : pct,
        width: animate ? (mounted ? `${pct}%` : '0%') : undefined,
        background: SEGMENT_COLORS[segmentKey].bg,
        borderRadius: pickSegmentRadius(index, segmentCount),
        transition: animate ? `width 500ms ${EASING.smooth}` : undefined,
        transitionDelay: animate ? `${index * 50}ms` : undefined,
      }}
    />
  );
}

/** First/last segments get rounded outer corners; the only-segment case rounds all four. */
function pickSegmentRadius(index: number, segmentCount: number): string | undefined {
  if (segmentCount === 1) return '6px';
  if (index === 0) return '6px 0 0 6px';
  if (index === segmentCount - 1) return '0 6px 6px 0';
  return undefined;
}

interface DistributionLegendProps {
  segments: readonly SegmentKey[];
  pct: Record<SegmentKey, number>;
}

function DistributionLegend({segments, pct}: DistributionLegendProps) {
  return (
    <div style={LEGEND_STYLE}>
      {segments.map((key) => (
        <LegendEntry key={key} segmentKey={key} pct={pct[key]} />
      ))}
    </div>
  );
}

const LEGEND_STYLE: React.CSSProperties = {
  // Solution B: fixed legend below the bar. NOT segment-positioned, so labels never wrap
  // regardless of how narrow any segment is. Centered as a single horizontal flex.
  display: 'flex',
  justifyContent: 'center',
  gap: 14,
  marginTop: 6,
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: '0.04em',
};

function LegendEntry({segmentKey, pct}: {segmentKey: SegmentKey; pct: number}) {
  const color = SEGMENT_COLORS[segmentKey].text;
  return (
    <span style={{display: 'inline-flex', alignItems: 'center', gap: 5, color}}>
      <span
        aria-hidden="true"
        style={{width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0}}
      />
      <span>{`${LEGEND_LABELS[segmentKey]} ${pct}%`}</span>
    </span>
  );
}
