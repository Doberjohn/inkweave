import {COLORS, FONTS, LETTER_SPACING, RADIUS} from '../../../shared/constants';

/**
 * Vote-tier colors — mirror the inline values in QuickVoteControl.tsx CHOICE_COLORS.
 * Keeping them inline here keeps the delta panel self-contained without forcing a
 * shared constants export.
 */
const TIER_HIGHER_GREEN = '#6ee7a0';
const TIER_LOWER_RED = '#f59090';
const TIER_EVEN_BLUE = '#60b5f5';

const ENGINE_TINT = COLORS.primary500;
const COMMUNITY_TINT = '#b691ff';

interface DeltaPanelProps {
  engineScore: number;
  communityScore: number;
  /** Vote count used in the footnote ("Based on N community votes"). */
  votes: number;
}

type DeltaTone = 'higher' | 'lower' | 'even';

/**
 * Score comparison visual for the mobile community-tab filled state. Lays out a 0-10 track
 * with a gold dot for Engine and an amethyst dot for Community, joined by a tone-tinted span
 * so the delta direction is immediately legible. The big tone-colored number + semantic copy
 * above (`+1.4 Community thinks higher`) is the headline; vote count anchors the sample size.
 *
 * Replaces the old inline `+1.4` blue-tinted strip that lived above the metric rows.
 */
export function DeltaPanel({engineScore, communityScore, votes}: DeltaPanelProps) {
  const delta = round1(communityScore - engineScore);
  const tone: DeltaTone = delta > 0 ? 'higher' : delta < 0 ? 'lower' : 'even';
  const toneColor = pickToneColor(tone);
  const arrow = pickArrow(tone);
  const sign = delta > 0 ? '+' : '';
  const headline = pickHeadline(tone);

  const enginePct = (engineScore / 10) * 100;
  const communityPct = (communityScore / 10) * 100;
  const spanLeft = Math.min(enginePct, communityPct);
  const spanWidth = Math.abs(communityPct - enginePct);

  return (
    <section aria-label="Community vs engine score" style={containerStyle(tone)}>
      <header style={HEADLINE_STYLE}>
        <span style={{...DELTA_NUMBER_STYLE, color: toneColor}}>
          <span aria-hidden="true" style={ARROW_STYLE}>{arrow}</span>
          {sign}
          {Math.abs(delta).toFixed(1)}
        </span>
        <span style={DELTA_COPY_STYLE}>{headline}</span>
      </header>

      <div
        role="img"
        aria-label={`Engine ${engineScore.toFixed(1)} vs Community ${communityScore.toFixed(1)}`}
        style={SCORE_BAR_STYLE}>
        <span aria-hidden="true" style={SCORE_TRACK_STYLE} />
        <span
          aria-hidden="true"
          style={{
            ...SCORE_SPAN_STYLE,
            left: `${spanLeft}%`,
            width: `${spanWidth}%`,
            boxShadow: `0 0 8px ${toneColor}`,
          }}
        />
        <ScoreMarker color={ENGINE_TINT} position={enginePct} labelPosition="above" label={`Engine ${engineScore.toFixed(1)}`} />
        <ScoreMarker color={COMMUNITY_TINT} position={communityPct} labelPosition="below" label={`Community ${communityScore.toFixed(1)}`} />
      </div>

      <div style={FOOTNOTE_STYLE}>
        Based on <strong style={{color: COLORS.text, fontWeight: 700}}>{votes}</strong>{' '}
        community {votes === 1 ? 'vote' : 'votes'}
      </div>
    </section>
  );
}

function pickToneColor(tone: DeltaTone): string {
  if (tone === 'higher') return TIER_HIGHER_GREEN;
  if (tone === 'lower') return TIER_LOWER_RED;
  return TIER_EVEN_BLUE;
}

function pickArrow(tone: DeltaTone): string {
  if (tone === 'higher') return '↑';
  if (tone === 'lower') return '↓';
  return '=';
}

function pickHeadline(tone: DeltaTone): string {
  if (tone === 'higher') return 'Community thinks higher';
  if (tone === 'lower') return 'Community thinks lower';
  return 'Even with Inkweave';
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

function containerStyle(tone: DeltaTone): React.CSSProperties {
  const inset = tone === 'higher'
    ? '0 0 0 1px rgba(110, 231, 160, 0.08) inset'
    : tone === 'lower'
      ? '0 0 0 1px rgba(245, 144, 144, 0.08) inset'
      : 'none';
  return {
    padding: '16px 18px 14px',
    borderRadius: RADIUS.xl,
    border: `1px solid ${COLORS.surfaceBorder}`,
    background: `linear-gradient(180deg, rgba(255, 255, 255, 0.02), transparent), ${COLORS.surfaceAlt}`,
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    fontFamily: FONTS.body,
    boxShadow: inset,
  };
}

const HEADLINE_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'baseline',
  gap: 12,
};

const DELTA_NUMBER_STYLE: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  letterSpacing: '-0.02em',
  fontFeatureSettings: '"tnum"',
  lineHeight: 1,
};

const ARROW_STYLE: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  marginRight: 4,
};

const DELTA_COPY_STYLE: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: COLORS.text,
};

const SCORE_BAR_STYLE: React.CSSProperties = {
  position: 'relative',
  height: 56,
};

const SCORE_TRACK_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 30,
  left: 0,
  right: 0,
  height: 4,
  background: '#2a2a3a',
  border: '1px solid rgba(255, 255, 255, 0.04)',
  borderRadius: 999,
};

const SCORE_SPAN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: 31,
  height: 2,
  background: `linear-gradient(90deg, ${ENGINE_TINT}, ${COMMUNITY_TINT})`,
  opacity: 0.85,
  borderRadius: 1,
};

const FOOTNOTE_STYLE: React.CSSProperties = {
  fontSize: 11,
  color: COLORS.textMuted,
};

interface ScoreMarkerProps {
  color: string;
  position: number;
  labelPosition: 'above' | 'below';
  label: string;
}

function ScoreMarker({color, position, labelPosition, label}: ScoreMarkerProps) {
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'absolute',
        top: 24,
        left: `${position}%`,
        marginLeft: -8,
        width: 16,
        height: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color,
      }}>
      <span
        style={{
          width: 12,
          height: 12,
          borderRadius: '50%',
          background: 'currentColor',
          // Inner ring effect: 2px gap to the panel bg, 1px halo of currentColor, soft outer glow.
          boxShadow: `0 0 0 2px ${COLORS.surfaceAlt}, 0 0 0 3px currentColor, 0 0 12px currentColor`,
        }}
      />
      <span
        style={{
          position: 'absolute',
          ...pickLabelHorizontalStyle(position),
          [labelPosition === 'above' ? 'bottom' : 'top']: 22,
          fontSize: 10,
          fontWeight: 700,
          textTransform: 'uppercase',
          letterSpacing: LETTER_SPACING.eyebrow,
          whiteSpace: 'nowrap',
          color,
        }}>
        {label}
      </span>
    </span>
  );
}

/**
 * Edge-aware label anchoring. With ~80px-wide labels ("COMMUNITY 9.0") on a ~280px panel, a
 * centered label spills past the panel boundary once the marker passes ~85% (right edge) or
 * drops below ~15% (left edge). Switch to side-anchored layouts there so the label sits beside
 * the dot instead of overflowing.
 *
 * Thresholds chosen at 85% / 15% so common scores like 8.0 (position 80) still center under the
 * dot — only genuinely-near-edge positions trigger the swap.
 */
function pickLabelHorizontalStyle(position: number): React.CSSProperties {
  if (position >= 85) return {right: 0, left: 'auto', transform: 'none'};
  if (position <= 15) return {left: 0, transform: 'none'};
  return {left: '50%', transform: 'translateX(-50%)'};
}
