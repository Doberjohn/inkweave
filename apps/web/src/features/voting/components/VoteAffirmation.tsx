import {COLORS, FONTS, RADIUS, hexRgba} from '../../../shared/constants';

interface VoteAffirmationProps {
  /** Column accent — gold for engine, amethyst for community. */
  accentColor: string;
  /** Primary line ("Thanks for your quick vote"). */
  title: string;
  /** Optional second line — echo of what the user submitted. */
  detail?: string;
  /** Tighter padding for inline placement next to other controls. */
  compact?: boolean;
}

/**
 * Affirms a vote the user has already cast on this pair from this browser.
 *
 * Mirror-image use: ENGINE side (left) shows it when QuickVote is in `result` state.
 * COMMUNITY side (right) shows it when the in-depth marker exists, replacing the
 * "Rate in detail" CTA so the user isn't pointed at a flow they've already done.
 */
export function VoteAffirmation({accentColor, title, detail, compact = false}: VoteAffirmationProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: compact ? '8px 12px' : '12px 14px',
        borderRadius: RADIUS.lg,
        border: `1px dashed ${hexRgba(accentColor, 0.45)}`,
        background: hexRgba(accentColor, 0.06),
        fontFamily: FONTS.body,
      }}>
      <span
        aria-hidden="true"
        style={{
          flex: '0 0 22px',
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: hexRgba(accentColor, 0.18),
          color: accentColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: 13,
          fontWeight: 700,
          lineHeight: 1,
        }}>
        ✓
      </span>
      <div style={{display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0}}>
        <span style={{fontSize: compact ? 12 : 13, fontWeight: 600, color: COLORS.text, lineHeight: 1.3}}>
          {title}
        </span>
        {detail && (
          <span style={{fontSize: 11, color: COLORS.textMuted, lineHeight: 1.3}}>
            {detail}
          </span>
        )}
      </div>
    </div>
  );
}
