import {COLORS, EASING, FONT_SIZES, FONTS, LETTER_SPACING, RADIUS, SPACING, TABULAR} from '../../../shared/constants';
import {BetaTag, LinkButton} from '../../../shared/components';
import type {QualityScore} from '../types';
import {scoreTier} from './scoreTier';

/**
 * The Deck Quality Score display (#472): the composite 0..100 score from
 * `score.ts` with a tier chip + quality meter. The glass-box breakdown lives in
 * `ScoreMathModal`, opened via `onShowMath` (the panel owns the modal since the
 * math needs the analyzers too); without the callback the button does not render.
 * Pure/prop-driven — the page's useDeckAnalysis hook produces the {@link QualityScore}.
 */
export function ScoreGauge({quality, onShowMath}: {quality: QualityScore; onShowMath?: () => void}) {
  const tier = scoreTier(quality.score);

  return (
    <div style={{background: COLORS.surface, border: `1px solid ${COLORS.surfaceBorder}`, borderRadius: RADIUS.card, padding: SPACING.lg}}>
      <div
        style={{
          fontFamily: FONTS.body,
          fontSize: `${FONT_SIZES.md}px`,
          fontWeight: 700,
          letterSpacing: LETTER_SPACING.cap,
          textTransform: 'uppercase',
          color: COLORS.textMuted,
          marginBottom: SPACING.md,
        }}>
        Deck quality score
        <BetaTag style={{marginLeft: 6}} />
      </div>

      <div style={{display: 'flex', alignItems: 'baseline', gap: SPACING.md, marginBottom: SPACING.md}}>
        <span style={{fontFamily: FONTS.body, fontWeight: 700, fontSize: FONT_SIZES.displayLg, lineHeight: 1, color: COLORS.text, ...TABULAR}}>{quality.score}</span>
        <span style={{fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xl}px`, color: COLORS.textDim}}>/100</span>
        <span
          style={{
            marginLeft: 'auto',
            alignSelf: 'center',
            fontFamily: FONTS.body,
            fontSize: `${FONT_SIZES.md}px`,
            fontWeight: 700,
            color: COLORS.background,
            background: tier.color,
            padding: '3px 10px',
            borderRadius: RADIUS.md,
          }}>
          {tier.label}
        </span>
      </div>

      <div style={{height: 8, borderRadius: RADIUS.sm, background: COLORS.surfaceAlt, overflow: 'hidden', marginBottom: SPACING.md}}>
        <div style={{width: `${quality.score}%`, height: '100%', background: tier.color, transition: `width 0.3s ${EASING.smooth}`}} />
      </div>

      {onShowMath && (
        <LinkButton onClick={onShowMath} style={{alignSelf: 'flex-start'}}>
          Why {quality.score}? Show the math
        </LinkButton>
      )}

      <div style={{marginTop: SPACING.md, fontFamily: FONTS.body, fontSize: `${FONT_SIZES.xs}px`, color: COLORS.textDim, lineHeight: 1.5}}>
        <span style={{color: COLORS.primary, fontWeight: 700}}>Beta scoring.</span> Targets are still being calibrated
        against real decks; treat this as a rough guide, not a verdict.
        <br />
        Inkweave Engine Score · config {quality.configVersion} · transparent weighted formula
      </div>
    </div>
  );
}
