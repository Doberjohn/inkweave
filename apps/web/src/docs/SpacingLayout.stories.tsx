import type {Meta, StoryObj} from '@storybook/react-vite';
import {
  SPACING,
  RADIUS,
  LAYOUT,
  BREAKPOINTS,
  Z_INDEX,
  COLORS,
  FONTS,
  FONT_SIZES,
} from '../shared/constants';

const sectionHeading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: COLORS.text,
  fontFamily: FONTS.body,
  margin: '0 0 16px',
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
  paddingBottom: 8,
};

// ── Spacing Scale ────────────────────────────────────────────────────

function SpacingScale() {
  const spacings = Object.entries(SPACING) as [string, number][];
  const radii = Object.entries(RADIUS) as [string, number][];
  const breakpoints = Object.entries(BREAKPOINTS) as [string, number][];
  const zIndices = Object.entries(Z_INDEX) as [string, number][];

  return (
    <div style={{padding: 24, maxWidth: 960}}>
      <h1
        style={{
          fontSize: 20,
          fontWeight: 700,
          color: COLORS.primary500,
          fontFamily: FONTS.body,
          margin: '0 0 8px',
        }}>
        Spacing & Layout
      </h1>
      <p
        style={{
          color: COLORS.textMuted,
          fontSize: FONT_SIZES.base,
          fontFamily: FONTS.body,
          margin: '0 0 32px',
        }}>
        Spacing scale (4px base grid), border radii, breakpoints, and layout constants.
      </p>

      {/* Spacing Scale */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Spacing Scale</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
          {spacings.map(([name, value]) => (
            <div key={name} style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <code
                style={{
                  color: COLORS.primary500,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                  minWidth: 60,
                }}>
                {name}
              </code>
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                  minWidth: 40,
                }}>
                {value}px
              </span>
              <div
                style={{
                  width: value,
                  height: 24,
                  background: 'rgba(212, 175, 55, 0.3)',
                  border: '1px solid rgba(212, 175, 55, 0.5)',
                  borderRadius: 2,
                }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* Border Radius */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Border Radius</h2>
        <div style={{display: 'flex', gap: 24, flexWrap: 'wrap'}}>
          {radii.map(([name, value]) => (
            <div
              key={name}
              style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8}}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  borderRadius: value,
                }}
              />
              <code
                style={{
                  color: COLORS.primary500,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                }}>
                {name}
              </code>
              <span
                style={{color: COLORS.textMuted, fontSize: FONT_SIZES.sm, fontFamily: FONTS.body}}>
                {value}px
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Breakpoints */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Breakpoints</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 60px 1fr',
            gap: '8px 16px',
            alignItems: 'center',
          }}>
          {breakpoints.map(([name, value]) => (
            <div key={name} style={{display: 'contents'}}>
              <code
                style={{
                  color: COLORS.primary500,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                }}>
                {name}
              </code>
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                }}>
                {value}px
              </span>
              <div style={{position: 'relative', height: 8}}>
                <div
                  style={{
                    width: `${(value / BREAKPOINTS.desktop) * 100}%`,
                    height: '100%',
                    background: 'rgba(212, 175, 55, 0.3)',
                    border: '1px solid rgba(212, 175, 55, 0.5)',
                    borderRadius: 2,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Layout Constants */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Layout Constants</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '220px 60px',
            gap: '8px 16px',
          }}>
          {(Object.entries(LAYOUT) as [string, number][]).map(([name, value]) => (
            <div key={name} style={{display: 'contents'}}>
              <code style={{color: COLORS.text, fontSize: FONT_SIZES.base, fontFamily: FONTS.body}}>
                {name}
              </code>
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                }}>
                {value}px
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Z-Index Scale */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Z-Index Scale</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
          {zIndices.map(([name, value]) => (
            <div key={name} style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <code
                style={{
                  color: COLORS.text,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                  minWidth: 140,
                }}>
                {name}
              </code>
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                  minWidth: 40,
                }}>
                {value}
              </span>
              <div
                style={{
                  width: `${(value / Z_INDEX.popover) * 200}px`,
                  height: 12,
                  background: COLORS.surface,
                  border: `1px solid ${COLORS.surfaceBorder}`,
                  borderRadius: 2,
                  position: 'relative',
                }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    background: `rgba(212, 175, 55, ${0.15 + (value / Z_INDEX.popover) * 0.35})`,
                    borderRadius: 2,
                  }}
                />
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
  title: 'Design System/Spacing & Layout',
  tags: ['autodocs'],
  parameters: {layout: 'fullscreen'},
};
export default meta;

type Story = StoryObj;

export const Scale: Story = {
  render: () => <SpacingScale />,
};
