import {COLORS, FONT_SIZES, NEUTRAL_LADDER, RADIUS, SPACING} from '../tokens/theme';

// Fills go in as backgroundColor: a `background` shorthand would reset the clip. Only the info
// fill is translucent, so only it is clipped to the padding box; errorBg is opaque.
const TONES = {
  info: {
    backgroundColor: NEUTRAL_LADDER.panel,
    backgroundClip: 'padding-box',
    border: `1px dashed ${NEUTRAL_LADDER.strongBorder}`,
    color: COLORS.textMuted,
  },
  error: {
    backgroundColor: COLORS.errorBg,
    border: `1px solid ${COLORS.errorBorder}`,
    color: COLORS.text,
  },
} as const;

interface NoticeProps {
  /** 'info' (default): loading, empty and setup states. 'error': a failed load, announced as an alert. */
  tone?: 'info' | 'error';
  children: React.ReactNode;
}

/**
 * A full-width message box: the dashed info box for a loading, empty or setup state, or the red
 * error box for a failed load. Only the error tone is a live region (role="alert"). A prose
 * notice, where EMPTY_BOX is a centred empty state.
 */
export function Notice({tone = 'info', children}: NoticeProps) {
  return (
    <div
      // A loading notice that turns into the error one mounts a new box: some screen readers
      // never announce an alert whose role arrives with its text on a box already there.
      key={tone}
      role={tone === 'error' ? 'alert' : undefined}
      style={{
        ...TONES[tone],
        borderRadius: RADIUS.card,
        padding: `${SPACING.section}px ${SPACING.lg}px`,
        fontSize: FONT_SIZES.base,
        lineHeight: 1.5,
        // An error can name an API path with no break opportunity, which would push a narrow
        // column sideways.
        overflowWrap: 'anywhere',
      }}>
      {children}
    </div>
  );
}
