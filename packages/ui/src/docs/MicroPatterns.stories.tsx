import type {Meta, StoryObj} from '@storybook/react-vite';
import {
  CAP_LABEL,
  CAP_LABEL_XS,
  COLORS,
  DISABLED_STYLE,
  EMPTY_BOX,
  FONTS,
  FONT_SIZES,
  GOLD_GLOW,
  NEUTRAL_LADDER,
  RADIUS,
  SPACING,
  SURFACE_CARD,
  TABULAR,
  TRUNCATE,
  VISUALLY_HIDDEN,
  searchFieldStyle,
} from '../tokens/theme';

const meta: Meta = {
  title: 'Docs/MicroPatterns',
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj;

/** The #511 micro-pattern consts: one source per retyped idiom. Spread, then override. */
export const Consts: Story = {
  render: () => (
    <div style={{display: 'grid', gap: SPACING.lg, maxWidth: 640, fontFamily: FONTS.body, color: COLORS.text}}>
      <div style={SURFACE_CARD}>
        <div style={CAP_LABEL}>Cap label (CAP_LABEL)</div>
        <div style={CAP_LABEL_XS}>Dense variant (CAP_LABEL_XS)</div>
        <p style={{fontSize: FONT_SIZES.base, color: COLORS.textMuted, margin: '8px 0 0'}}>
          This panel is SURFACE_CARD. Radius rule: RADIUS.card standalone, RADIUS.lg nested.
        </p>
      </div>

      <div style={{...EMPTY_BOX, padding: SPACING.lg}}>Nothing here yet (EMPTY_BOX)</div>

      <div style={{...SURFACE_CARD, display: 'flex', gap: SPACING.md, alignItems: 'center'}}>
        <span style={{...TRUNCATE, minWidth: 0, flex: 1}}>
          TRUNCATE clips a single line — remember the ancestor minWidth: 0 in flex/grid layouts
        </span>
        <span style={{...TABULAR, fontSize: FONT_SIZES.lg}}>1,234 / 16,511</span>
      </div>

      <div style={{...SURFACE_CARD, position: 'relative'}}>
        VISUALLY_HIDDEN keeps text for screen readers and draws none of it: a card chip's name,
        a heading the layout implies. The next line is in this panel, read but not shown:
        <span style={VISUALLY_HIDDEN}>Read by screen readers only (VISUALLY_HIDDEN)</span>
      </div>

      <div
        style={{
          ...SURFACE_CARD,
          border: `1px solid ${GOLD_GLOW.activeBorder}`,
          background: GOLD_GLOW.activeBg,
          boxShadow: GOLD_GLOW.shadow,
        }}>
        GOLD_GLOW: the one-gold selection recipe (activeBorder / hoverBorder / strongBorder /
        activeBg / hoverBg / shadow / focusRing) — every value derives from COLORS.primary.
      </div>

      <div
        style={{
          padding: SPACING.lg,
          borderRadius: RADIUS.card,
          background: NEUTRAL_LADDER.card,
          backgroundClip: 'padding-box',
          border: `1px solid ${NEUTRAL_LADDER.border}`,
        }}>
        NEUTRAL_LADDER: gray400 over the page (panel / card / navHover / border / strongBorder).
        This box is card on border, its fill clipped to the padding box.
        <span
          style={{
            display: 'inline-block',
            marginLeft: SPACING.sm,
            padding: `0 ${SPACING.sm}px`,
            borderRadius: RADIUS.md,
            background: NEUTRAL_LADDER.navHover,
            color: COLORS.primary,
            boxShadow: `inset 0 0 0 1px ${GOLD_GLOW.strongBorder}`,
          }}>
          GOLD_GLOW.strongBorder
        </span>
      </div>

      <button type="button" disabled style={{...SURFACE_CARD, ...DISABLED_STYLE, fontFamily: FONTS.body, color: COLORS.text}}>
        DISABLED_STYLE: one dimmed recipe for every control
      </button>

      <input
        readOnly
        aria-label="searchFieldStyle example"
        placeholder="searchFieldStyle: raised at rest, lighter edge on hover, gold with the ring on focus"
        style={{
          ...searchFieldStyle({focused: false, hovered: false}),
          height: 36,
          padding: `0 ${SPACING.md}px`,
          borderRadius: RADIUS.lg,
          color: COLORS.text,
          fontFamily: FONTS.body,
          fontSize: FONT_SIZES.base,
          outline: 'none',
        }}
      />
    </div>
  ),
};
