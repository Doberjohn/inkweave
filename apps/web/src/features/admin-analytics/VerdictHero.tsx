import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import {biasCopy} from './biasCopy';

interface VerdictHeroProps {
  meanGap: number | null;
  accuracySentiment: number | null;
}

/** Within this magnitude the engine reads as well-calibrated; a small lean is noted in the read line, not the headline. */
const CALIBRATION_BAND = 0.5;
/** meanGap is clamped to +/- this before positioning the scale dot. */
const SCALE_CLAMP = 1.5;

interface Verdict {
  word: string;
  wordColor: string;
  numberColor: string;
}

/**
 * A single band drives the whole hero so the verb, number, dot, and read line
 * never contradict each other. Within +/-CALIBRATION_BAND the engine is
 * "well-calibrated" (green verb, neutral-toned number/dot); beyond it the verb,
 * number, and dot all take the over-rates (error) or under-rates (success)
 * color together.
 */
function verdictFor(meanGap: number | null): Verdict {
  if (meanGap == null) return {word: 'not enough data', wordColor: COLORS.textMuted, numberColor: COLORS.textMuted};
  if (Math.abs(meanGap) < CALIBRATION_BAND) {
    return {word: 'well-calibrated', wordColor: COLORS.success, numberColor: COLORS.textMuted};
  }
  const dirColor = meanGap < 0 ? COLORS.error : COLORS.success;
  return {word: meanGap < 0 ? 'runs generous' : 'runs harsh', wordColor: dirColor, numberColor: dirColor};
}

/**
 * Calibration-tab hero: a serif verdict headline, the big meanGap number, a
 * plain-English read, a diverging over/under scale, and an accuracy-sentiment
 * side column. Admin-scale display sizes (30px headline, 44px number) are
 * deliberate exceptions to the public type scale.
 */
export function VerdictHero({meanGap, accuracySentiment}: VerdictHeroProps) {
  const verdict = verdictFor(meanGap);
  const {read} = biasCopy(meanGap);

  // Position the dot on the diverging scale; clamp to +/- SCALE_CLAMP points.
  const clamped = Math.max(-SCALE_CLAMP, Math.min(SCALE_CLAMP, meanGap ?? 0));
  const dotLeft = 50 + (clamped / SCALE_CLAMP) * 50;
  const dotColor = verdict.numberColor;

  return (
    <section
      style={{
        display: 'flex',
        gap: SPACING.lg,
        background: COLORS.surfaceAlt,
        border: `1px solid ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.card,
        padding: SPACING.xl,
        marginBottom: SPACING.section,
      }}>
      <div style={{flex: 1}}>
        <div
          style={{
            fontSize: FONT_SIZES.xs,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            fontWeight: 700,
          }}>
          Engine calibration
        </div>
        <h2
          style={{
            fontFamily: FONTS.hero,
            fontSize: 30,
            fontWeight: 400,
            lineHeight: 1.15,
            margin: '6px 0 4px',
            color: COLORS.text,
          }}>
          The engine <span style={{color: verdict.wordColor, fontStyle: 'italic'}}>{verdict.word}</span>
        </h2>
        <div style={{fontSize: 44, fontWeight: 800, lineHeight: 1.05, margin: '4px 0 6px', color: verdict.numberColor}}>
          {meanGap == null ? '—' : meanGap.toFixed(2)}
        </div>
        <div style={{fontSize: FONT_SIZES.base, color: COLORS.gray700, maxWidth: 380}}>{read}</div>
        <div style={{display: 'flex', alignItems: 'center', gap: SPACING.sm, marginTop: SPACING.section}}>
          <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>over-rates</span>
          <div style={{position: 'relative', flex: 1, height: 4, background: COLORS.surface, borderRadius: 2}}>
            <div style={{position: 'absolute', left: '50%', top: -3, width: 1, height: 10, background: COLORS.textDim}} />
            <div
              style={{
                position: 'absolute',
                left: `${dotLeft}%`,
                top: -3,
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: dotColor,
                transform: 'translateX(-50%)',
              }}
            />
          </div>
          <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>under-rates</span>
        </div>
      </div>
      <div style={{width: 150, borderLeft: `1px solid ${COLORS.surfaceBorder}`, paddingLeft: SPACING.lg}}>
        <div
          style={{
            fontSize: FONT_SIZES.xs,
            color: COLORS.textMuted,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
          Accuracy sentiment
        </div>
        <div style={{fontSize: FONT_SIZES.xxxl, fontWeight: 700, margin: '4px 0 2px', fontFamily: FONTS.body}}>
          {accuracySentiment == null ? '—' : (accuracySentiment > 0 ? '+' : '') + accuracySentiment.toFixed(2)}
        </div>
        <div style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>thumbs: too-low vs too-high</div>
      </div>
    </section>
  );
}
