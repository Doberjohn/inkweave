import {COLORS, SPACING, FONT_SIZES, RADIUS} from '../../../shared/constants';

interface TierRowProps {
  label: string;
  text?: string;
  score?: number;
  showText: boolean;
  showScore: boolean;
  textError?: string;
  scoreError?: string;
  onTextChange: (raw: string) => void;
  onScoreChange: (raw: string) => void;
}

const labelStyle = {
  fontSize: FONT_SIZES.xs,
  color: COLORS.gray600,
  display: 'block',
  marginBottom: 4,
};

const fieldStyle = {
  background: COLORS.surfaceAlt,
  color: COLORS.text,
  border: `1px solid ${COLORS.surfaceHover}`,
  borderRadius: RADIUS.sm,
  fontSize: FONT_SIZES.sm,
};

const errorStyle = {color: COLORS.error, fontSize: FONT_SIZES.xs, marginTop: 4};

/**
 * Presentational, UNCONTROLLED editor row for a single tuning value.
 * Uses `defaultValue` so the parent hook never has to feed values back on
 * re-render; each keystroke fires `onTextChange` / `onScoreChange` with the
 * raw string for the hook to validate and stage.
 */
export function TierRow({
  label,
  text,
  score,
  showText,
  showScore,
  textError,
  scoreError,
  onTextChange,
  onScoreChange,
}: TierRowProps) {
  return (
    <div style={{marginBottom: SPACING.md}}>
      <label style={labelStyle}>{label}</label>
      {showText && (
        <>
          <textarea
            aria-label={`${label} text`}
            style={{...fieldStyle, width: '100%', padding: '8px 10px', minHeight: 60}}
            defaultValue={text}
            onChange={(e) => onTextChange(e.target.value)}
          />
          {textError && <div style={errorStyle}>{textError}</div>}
        </>
      )}
      {showScore && (
        <>
          <input
            aria-label={`${label} score`}
            type="number"
            min={1}
            max={10}
            step={1}
            style={{...fieldStyle, width: 80, padding: '6px 8px', marginTop: showText ? SPACING.xs : 0}}
            defaultValue={score}
            onChange={(e) => onScoreChange(e.target.value)}
          />
          {scoreError && <div style={errorStyle}>{scoreError}</div>}
        </>
      )}
    </div>
  );
}
