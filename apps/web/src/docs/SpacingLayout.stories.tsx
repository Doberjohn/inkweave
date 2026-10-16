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
  fontSize: FONT_SIZES.xl,
  fontWeight: 600,
  color: COLORS.text,
  fontFamily: FONTS.body,
  margin: '0 0 16px',
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
  paddingBottom: 8,
};

/** A token's name, in gold. */
const tokenName: React.CSSProperties = {
  color: COLORS.primary500,
  fontSize: FONT_SIZES.base,
  fontFamily: FONTS.body,
};

/** A token's value, muted. */
const tokenValue: React.CSSProperties = {
  color: COLORS.textMuted,
  fontSize: FONT_SIZES.base,
  fontFamily: FONTS.body,
};

/** The gold bar that draws a value to scale. */
const goldBar: React.CSSProperties = {
  background: 'rgba(212, 175, 55, 0.3)',
  border: '1px solid rgba(212, 175, 55, 0.5)',
  borderRadius: RADIUS.xs,
};

/** One token per row: name, value, then its bar. */
const tokenRow: React.CSSProperties = {display: 'flex', alignItems: 'center', gap: 16};

/** Lays a row's cells straight into the parent grid. */
const gridRow: React.CSSProperties = {display: 'contents'};

/** A token scale's entries, as name and value pairs. */
const entriesOf = (scale: Record<string, number>) => Object.entries(scale);

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section style={{marginBottom: 32}}>
      <h2 style={sectionHeading}>{title}</h2>
      {children}
    </section>
  );
}

// ── Sections ─────────────────────────────────────────────────────────

function SpacingSection() {
  return (
    <Section title="Spacing Scale">
      <div style={{display: 'flex', flexDirection: 'column', gap: 12}}>
        {entriesOf(SPACING).map(([name, value]) => (
          <div key={name} style={tokenRow}>
            <code style={{...tokenName, minWidth: 60}}>{name}</code>
            <span style={{...tokenValue, minWidth: 40}}>{value}px</span>
            <div style={{width: value, height: 24, ...goldBar}} />
          </div>
        ))}
      </div>
    </Section>
  );
}

function RadiusSection() {
  return (
    <Section title="Border Radius">
      <div style={{display: 'flex', gap: 24, flexWrap: 'wrap'}}>
        {entriesOf(RADIUS).map(([name, value]) => (
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
            <code style={tokenName}>{name}</code>
            <span style={{...tokenValue, fontSize: FONT_SIZES.sm}}>{value}px</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function BreakpointSection() {
  return (
    <Section title="Breakpoints">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 60px 1fr',
          gap: '8px 16px',
          alignItems: 'center',
        }}>
        {entriesOf(BREAKPOINTS).map(([name, value]) => (
          <div key={name} style={gridRow}>
            <code style={tokenName}>{name}</code>
            <span style={tokenValue}>{value}px</span>
            <div style={{position: 'relative', height: 8}}>
              <div
                style={{
                  width: `${(value / BREAKPOINTS.desktop) * 100}%`,
                  height: '100%',
                  ...goldBar,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

function LayoutSection() {
  return (
    <Section title="Layout Constants">
      <div style={{display: 'grid', gridTemplateColumns: '220px 60px', gap: '8px 16px'}}>
        {entriesOf(LAYOUT).map(([name, value]) => (
          <div key={name} style={gridRow}>
            <code style={{...tokenName, color: COLORS.text}}>{name}</code>
            <span style={tokenValue}>{value}px</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function ZIndexSection() {
  return (
    <Section title="Z-Index Scale">
      <div style={{display: 'flex', flexDirection: 'column', gap: 8}}>
        {entriesOf(Z_INDEX).map(([name, value]) => (
          <div key={name} style={tokenRow}>
            <code style={{...tokenName, color: COLORS.text, minWidth: 140}}>{name}</code>
            <span style={{...tokenValue, minWidth: 40}}>{value}</span>
            <div
              style={{
                width: `${(value / Z_INDEX.popover) * 200}px`,
                height: 12,
                background: COLORS.surface,
                border: `1px solid ${COLORS.surfaceBorder}`,
                borderRadius: RADIUS.xs,
                position: 'relative',
              }}>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: `rgba(212, 175, 55, ${0.15 + (value / Z_INDEX.popover) * 0.35})`,
                  borderRadius: RADIUS.xs,
                }}
              />
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Spacing Scale ────────────────────────────────────────────────────

function SpacingScale() {
  return (
    <div style={{padding: 24, maxWidth: 960}}>
      <h1
        style={{
          fontSize: FONT_SIZES.xxl,
          fontWeight: 700,
          color: COLORS.primary500,
          fontFamily: FONTS.body,
          margin: '0 0 8px',
        }}>
        Spacing & Layout
      </h1>
      <p style={{...tokenValue, margin: '0 0 32px'}}>
        Spacing scale (4px base grid), border radii, breakpoints, and layout constants.
      </p>
      <SpacingSection />
      <RadiusSection />
      <BreakpointSection />
      <LayoutSection />
      <ZIndexSection />
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
