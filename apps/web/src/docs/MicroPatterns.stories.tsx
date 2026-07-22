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
  SPACING,
  SURFACE_CARD,
  TABULAR,
  TRUNCATE,
} from '../shared/constants';

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

      <div
        style={{
          ...SURFACE_CARD,
          border: `1px solid ${GOLD_GLOW.activeBorder}`,
          background: GOLD_GLOW.activeBg,
          boxShadow: GOLD_GLOW.shadow,
        }}>
        GOLD_GLOW: the one-gold selection recipe (activeBorder / hoverBorder / activeBg / hoverBg /
        shadow / focusRing) — every value derives from COLORS.primary.
      </div>

      <button type="button" disabled style={{...SURFACE_CARD, ...DISABLED_STYLE, fontFamily: FONTS.body, color: COLORS.text}}>
        DISABLED_STYLE: one dimmed recipe for every control
      </button>
    </div>
  ),
};
