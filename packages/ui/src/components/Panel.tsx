import {useId} from 'react';
import {COLORS, FONT_SIZES, NEUTRAL_LADDER, RADIUS, SPACING} from '../tokens/theme';

interface PanelProps {
  /**
   * The panel's h2, which also names it as a region: text, or text with links in it. The
   * region's name is the text.
   */
  title?: React.ReactNode;
  /** The right end of the header row: a link, a control or a caption. */
  action?: React.ReactNode;
  children: React.ReactNode;
  /**
   * Default true. False drops the body padding so a table or list runs edge to edge; the header
   * then keeps its own padding and a divider underneath.
   */
  padded?: boolean;
  /**
   * The title can take focus from script (tabIndex −1), so a focus handoff can land on it when
   * the control that had focus goes, such as a Retry that a successful load removes. Default
   * false: a heading is not a tab stop either way.
   */
  titleFocusable?: boolean;
}

/** The header row: the h2 title on the left, the action on the right. Flush panels pad it and rule it off. */
function PanelHeader({
  title,
  titleId,
  action,
  padded,
  titleFocusable,
}: Omit<PanelProps, 'children'> & {titleId: string}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: SPACING.md,
        ...(padded
          ? {}
          : {
              padding: `${SPACING.section}px ${SPACING.lg}px`,
              borderBottom: `1px solid ${NEUTRAL_LADDER.border}`,
            }),
      }}>
      {title && (
        <h2
          id={titleId}
          tabIndex={titleFocusable ? -1 : undefined}
          style={{margin: 0, fontSize: FONT_SIZES.base, fontWeight: 700, color: COLORS.text}}>
          {title}
        </h2>
      )}
      {action != null && (
        <div style={{marginLeft: 'auto', fontSize: FONT_SIZES.md, color: COLORS.textMuted}}>
          {action}
        </div>
      )}
    </div>
  );
}

/**
 * A bordered surface with an optional header row (the h2 title on the left, an action on the
 * right), which admin's insights pages are built from. A titled panel is a named region, so
 * screen-reader users can move between panels the way they move between headings. SURFACE_CARD
 * is the app's own panel look.
 */
export function Panel({title, action, children, padded = true, titleFocusable}: PanelProps) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={title ? titleId : undefined}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: padded ? SPACING.md : 0,
        minWidth: 0,
        // The translucent fill stops at the border, so the edge stays on the ladder. Not the
        // `background` shorthand: it would reset the clip.
        backgroundColor: NEUTRAL_LADDER.card,
        backgroundClip: 'padding-box',
        border: `1px solid ${NEUTRAL_LADDER.border}`,
        borderRadius: RADIUS.card,
        padding: padded ? SPACING.xl : 0,
        // A flush table's corners would poke past the radius.
        overflow: padded ? undefined : 'hidden',
      }}>
      {(Boolean(title) || action != null) && (
        <PanelHeader
          title={title}
          titleId={titleId}
          action={action}
          padded={padded}
          titleFocusable={titleFocusable}
        />
      )}
      {children}
    </section>
  );
}
