import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, FONTS, FONT_SIZES, RADIUS, TIER_COLORS, blackRgba} from '../tokens/theme';
import {INK_CHIP_COLORS, INK_COLORS, ALL_INKS} from '../tokens/lorcana';

// ── Swatch component ─────────────────────────────────────────────────
// Renders a single color token with visual preview, name, and hex value.

function ColorSwatch({name, value, large}: {name: string; value: string; large?: boolean}) {
  const height = large ? 72 : 56;

  return (
    <div
      style={{
        borderRadius: RADIUS.lg,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#1a1a2e',
      }}>
      {/* Color preview: fills the top of the card */}
      <div
        style={{
          height,
          background: value,
          // Subtle checkerboard behind transparent/dark colors so they're distinguishable
          backgroundImage:
            'linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%),' +
            'linear-gradient(45deg, rgba(255,255,255,0.03) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.03) 75%)',
          backgroundSize: '8px 8px',
          backgroundPosition: '0 0, 4px 4px',
          borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      />
      {/* Token info */}
      <div style={{padding: '8px 12px'}}>
        <div
          style={{
            color: '#e8e8e8',
            fontSize: FONT_SIZES.base,
            fontWeight: 500,
            fontFamily: FONTS.body,
            marginBottom: 2,
          }}>
          {name}
        </div>
        <code
          style={{
            color: '#90a1b9',
            fontSize: FONT_SIZES.sm,
          }}>
          {value}
        </code>
      </div>
    </div>
  );
}

// ── Group renderer ───────────────────────────────────────────────────

function ColorGroup({
  title,
  colors,
  large,
}: {
  title: string;
  colors: {name: string; value: string}[];
  large?: boolean;
}) {
  return (
    <section style={{marginBottom: 32}}>
      <h2
        style={{
          fontSize: FONT_SIZES.xl,
          fontWeight: 600,
          color: '#e8e8e8',
          fontFamily: FONTS.body,
          margin: '0 0 16px',
          borderBottom: '1px solid #333355',
          paddingBottom: 8,
        }}>
        {title}
      </h2>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: large
            ? 'repeat(auto-fill, minmax(260px, 1fr))'
            : 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 12,
        }}>
        {colors.map((c) => (
          <ColorSwatch key={c.name} name={c.name} value={c.value} large={large} />
        ))}
      </div>
    </section>
  );
}

// ── Color Palette page ───────────────────────────────────────────────

// Static swatch data hoisted out of the component (the render function stays
// small; the data reads live from the token objects either way).
const PALETTE_GROUPS = [
    {
      title: 'Background & Surface',
      colors: [
        {name: 'background', value: COLORS.background},
        {name: 'surface', value: COLORS.surface},
        {name: 'surfaceHover', value: COLORS.surfaceHover},
        {name: 'surfaceAlt', value: COLORS.surfaceAlt},
        {name: 'surfaceBorder', value: COLORS.surfaceBorder},
      ],
    },
    {
      title: 'Elevation Ladder (higher = lighter; shadows are secondary cues)',
      colors: [
        {name: 'surface (rest)', value: COLORS.surface},
        {name: 'surfaceRaised', value: COLORS.surfaceRaised},
        {name: 'surfaceFloating', value: COLORS.surfaceFloating},
        {name: 'surfaceOverlay', value: COLORS.surfaceOverlay},
      ],
    },
    {
      title: 'Strength Tiers (TIER_COLORS)',
      colors: [
        {name: 'perfect', value: TIER_COLORS.perfect.color},
        {name: 'strong', value: TIER_COLORS.strong.color},
        {name: 'moderate', value: TIER_COLORS.moderate.color},
        {name: 'weak', value: TIER_COLORS.weak.color},
      ],
    },
    {
      title: 'Primary (Gold)',
      large: true,
      colors: [
        {name: 'primary', value: COLORS.primary},
        {name: 'primaryHover', value: COLORS.primaryHover},
        {name: 'primaryMuted', value: COLORS.primaryMuted},
        {name: 'primary500', value: COLORS.primary500},
        {name: 'primary700', value: COLORS.primary700},
      ],
    },
    {
      title: 'Text',
      colors: [
        {name: 'text', value: COLORS.text},
        {name: 'textMuted', value: COLORS.textMuted},
        {name: 'textDim', value: COLORS.textDim},
        {name: 'descriptionText', value: COLORS.descriptionText},
        {name: 'searchPlaceholder', value: COLORS.searchPlaceholder},
      ],
    },
    {
      title: 'Semantic',
      colors: [
        {name: 'error', value: COLORS.error},
        {name: 'errorBg', value: COLORS.errorBg},
        {name: 'errorBorder', value: COLORS.errorBorder},
        {name: 'successBg', value: COLORS.successBg},
      ],
    },
    {
      title: 'Gray Scale (Dark Theme)',
      colors: [
        {name: 'gray50', value: COLORS.gray50},
        {name: 'gray100', value: COLORS.gray100},
        {name: 'gray200', value: COLORS.gray200},
        {name: 'gray300', value: COLORS.gray300},
        {name: 'gray400', value: COLORS.gray400},
        {name: 'gray600', value: COLORS.gray600},
        {name: 'gray700', value: COLORS.gray700},
        {name: 'gray800', value: COLORS.gray800},
        {name: 'gray900', value: COLORS.gray900},
      ],
    },
  ];

const INK_SWATCHES = ALL_INKS.map((ink) => ({
  name: ink,
  bg: INK_COLORS[ink].bg,
  text: INK_COLORS[ink].text,
  border: INK_COLORS[ink].border,
}));

/** The letter chips that name each card in a synergy line (ConnectionGroup), on the game's ink colours. */
function InkChipSwatches() {
  return (
    <section style={{marginBottom: 32}}>
      <h2
        style={{
          fontSize: FONT_SIZES.xl,
          fontWeight: 600,
          color: COLORS.text,
          fontFamily: FONTS.body,
          margin: '0 0 16px',
          borderBottom: `1px solid ${COLORS.surfaceBorder}`,
          paddingBottom: 8,
        }}>
        Ink Chip Colors (INK_CHIP_COLORS)
      </h2>
      <div style={{display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12}}>
        {ALL_INKS.map((ink) => {
          const chip = INK_CHIP_COLORS[ink];
          return (
            <div key={ink} style={{display: 'flex', alignItems: 'center', gap: 10}}>
              <span
                style={{
                  background: chip.bg,
                  color: chip.text,
                  border: `1px solid ${blackRgba(1)}`,
                  fontFamily: FONTS.body,
                  fontWeight: 700,
                  fontSize: FONT_SIZES.sm,
                  lineHeight: 1,
                  padding: '4px 6px',
                  borderRadius: RADIUS.sm,
                }}>
                {ink.charAt(0)}
              </span>
              <code style={{color: COLORS.textMuted, fontSize: FONT_SIZES.sm}}>
                {ink}: {chip.bg} on {chip.text}
              </code>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function ColorPalette() {
  const groups = PALETTE_GROUPS;
  const inkColors = INK_SWATCHES;
  return (
    <div style={{padding: 24, maxWidth: 960}}>
      <h1
        style={{
          fontSize: FONT_SIZES.xxl,
          fontWeight: 700,
          color: '#d4af37',
          fontFamily: FONTS.body,
          margin: '0 0 8px',
        }}>
        Color Palette
      </h1>
      <p
        style={{
          color: '#90a1b9',
          fontSize: FONT_SIZES.base,
          fontFamily: FONTS.body,
          margin: '0 0 32px',
        }}>
        All color tokens from <code style={{color: '#c8c8d8'}}>inkweave-ui/tokens/</code>.
        These render live from the actual COLORS object. If a token changes, this page updates
        automatically.
      </p>

      {groups.map((g) => (
        <ColorGroup key={g.title} title={g.title} colors={g.colors} large={g.large} />
      ))}

      {/* Ink colors get special treatment (3 values per ink) */}
      <section style={{marginBottom: 32}}>
        <h2
          style={{
            fontSize: FONT_SIZES.xl,
            fontWeight: 600,
            color: '#e8e8e8',
            fontFamily: FONTS.body,
            margin: '0 0 16px',
            borderBottom: '1px solid #333355',
            paddingBottom: 8,
          }}>
          Ink Colors
        </h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}>
          {inkColors.map((ink) => (
            <div
              key={ink.name}
              style={{
                background: ink.bg,
                border: `1px solid ${ink.border}`,
                borderRadius: RADIUS.lg,
                padding: 16,
              }}>
              <div
                style={{
                  color: ink.text,
                  fontSize: FONT_SIZES.lg,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  marginBottom: 8,
                }}>
                {ink.name}
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                <span
                  style={{
                    color: '#90a1b9',
                    fontSize: FONT_SIZES.sm,
                    fontFamily: FONTS.body,
                  }}>
                  bg: {ink.bg}
                </span>
                <span
                  style={{
                    color: '#90a1b9',
                    fontSize: FONT_SIZES.sm,
                    fontFamily: FONTS.body,
                  }}>
                  text: {ink.text}
                </span>
                <span
                  style={{
                    color: '#90a1b9',
                    fontSize: FONT_SIZES.sm,
                    fontFamily: FONTS.body,
                  }}>
                  border: {ink.border}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <InkChipSwatches />
    </div>
  );
}

// ── Story config ─────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Design System/Colors',
  tags: ['autodocs'],
  parameters: {layout: 'fullscreen'},
};
export default meta;

type Story = StoryObj;

export const Palette: Story = {
  render: () => <ColorPalette />,
};
