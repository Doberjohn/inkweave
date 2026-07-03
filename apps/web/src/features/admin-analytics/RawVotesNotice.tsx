import {COLORS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';

/** Shown in place of the raw-votes panels when the artifact has hasRawVotes: false. */
export function RawVotesNotice() {
  return (
    <section
      style={{
        background: COLORS.surfaceAlt,
        border: `1px dashed ${COLORS.surfaceBorder}`,
        borderRadius: RADIUS.lg,
        padding: SPACING.md,
        marginBottom: SPACING.section,
        fontSize: FONT_SIZES.base,
        color: COLORS.textMuted,
      }}>
      Weekly activity, dimension participation, and voter counts need raw votes. Set{' '}
      <code style={{color: COLORS.primary}}>SUPABASE_SERVICE_ROLE_KEY</code> in the build env and re-run{' '}
      <code style={{color: COLORS.primary}}>pnpm precompute-vote-analytics</code> to enable them.
    </section>
  );
}
