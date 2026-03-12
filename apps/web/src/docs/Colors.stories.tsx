import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS, INK_COLORS, ALL_INKS} from '../shared/constants';

// ── Swatch component ─────────────────────────────────────────────────
// Renders a single color token with visual preview, name, and hex value.

function ColorSwatch({name, value, large}: {name: string; value: string; large?: boolean}) {
  const height = large ? 72 : 56;

  return (
    <div
      style={{
        borderRadius: 8,
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        background: '#1a1a2e',
      }}>
      {/* Color preview — fills the top of the card */}
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
            fontSize: 13,
            fontWeight: 500,
            fontFamily: 'Inter, sans-serif',
            marginBottom: 2,
          }}>
          {name}
        </div>
        <code
          style={{
            color: '#90a1b9',
            fontSize: 11,
            fontFamily: "'JetBrains Mono', 'Fira Code', monospace",
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
          fontSize: 16,
          fontWeight: 600,
          color: '#e8e8e8',
          fontFamily: 'Inter, sans-serif',
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

function ColorPalette() {
  const groups = [
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

  const inkColors = ALL_INKS.map((ink) => ({
    name: ink,
    bg: INK_COLORS[ink].bg,
    text: INK_COLORS[ink].text,
    border: INK_COLORS[ink].border,
  }));

  return (
    <div style={{padding: 24, maxWidth: 960}}>
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: '#d4af37',
          fontFamily: 'Inter, sans-serif',
          margin: '0 0 8px',
        }}>
        Color Palette
      </h1>
      <p
        style={{
          color: '#90a1b9',
          fontSize: 13,
          fontFamily: 'Inter, sans-serif',
          margin: '0 0 32px',
        }}>
        All color tokens from <code style={{color: '#c8c8d8'}}>shared/constants/theme.ts</code>.
        These render live from the actual COLORS object — if a token changes, this page updates
        automatically.
      </p>

      {groups.map((g) => (
        <ColorGroup key={g.title} title={g.title} colors={g.colors} large={g.large} />
      ))}

      {/* Ink colors get special treatment — 3 values per ink */}
      <section style={{marginBottom: 32}}>
        <h2
          style={{
            fontSize: 16,
            fontWeight: 600,
            color: '#e8e8e8',
            fontFamily: 'Inter, sans-serif',
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
                borderRadius: 8,
                padding: 16,
              }}>
              <div
                style={{
                  color: ink.text,
                  fontSize: 14,
                  fontWeight: 600,
                  fontFamily: 'Inter, sans-serif',
                  marginBottom: 8,
                }}>
                {ink.name}
              </div>
              <div style={{display: 'flex', flexDirection: 'column', gap: 4}}>
                <span style={{color: '#90a1b9', fontSize: 11, fontFamily: 'Inter, sans-serif'}}>
                  bg: {ink.bg}
                </span>
                <span style={{color: '#90a1b9', fontSize: 11, fontFamily: 'Inter, sans-serif'}}>
                  text: {ink.text}
                </span>
                <span style={{color: '#90a1b9', fontSize: 11, fontFamily: 'Inter, sans-serif'}}>
                  border: {ink.border}
                </span>
              </div>
            </div>
          ))}
        </div>
      </section>
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
