import type {Meta, StoryObj} from '@storybook/react-vite';
import {FONTS, FONT_SIZES, COLORS} from '../shared/constants';

const sectionHeading: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: COLORS.text,
  fontFamily: FONTS.body,
  margin: '0 0 16px',
  borderBottom: `1px solid ${COLORS.surfaceBorder}`,
  paddingBottom: 8,
};

// ── Type Scale ───────────────────────────────────────────────────────

function TypeScale() {
  const sizes = Object.entries(FONT_SIZES) as [string, number][];

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
        Typography
      </h1>
      <p
        style={{
          color: COLORS.textMuted,
          fontSize: FONT_SIZES.base,
          fontFamily: FONTS.body,
          margin: '0 0 32px',
        }}>
        Type scale and font families from{' '}
        <code style={{color: COLORS.descriptionText}}>shared/constants/theme.ts</code>. Based on a
        ~1.25 major third ratio with 13px base.
      </p>

      {/* Font Families */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Font Families</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
          <div>
            <div
              style={{
                color: COLORS.textMuted,
                fontSize: FONT_SIZES.base,
                fontFamily: FONTS.body,
                marginBottom: 8,
              }}>
              <code style={{color: COLORS.descriptionText}}>FONTS.body</code> — Inter
            </div>
            <div style={{fontSize: 20, fontFamily: FONTS.body, color: COLORS.text}}>
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
          <div>
            <div
              style={{
                color: COLORS.textMuted,
                fontSize: FONT_SIZES.base,
                fontFamily: FONTS.body,
                marginBottom: 8,
              }}>
              <code style={{color: COLORS.descriptionText}}>FONTS.hero</code> — Tinos (serif)
            </div>
            <div style={{fontSize: 20, fontFamily: FONTS.hero, color: COLORS.text}}>
              The quick brown fox jumps over the lazy dog
            </div>
          </div>
        </div>
      </section>

      {/* Type Scale */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Type Scale</h2>
        <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
          {sizes.map(([name, size]) => (
            <div
              key={name}
              style={{
                display: 'grid',
                gridTemplateColumns: '80px 50px 1fr',
                alignItems: 'baseline',
                padding: '12px 0',
                borderBottom: `1px solid ${COLORS.gray100}`,
              }}>
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
                {size}px
              </span>
              <span style={{fontSize: size, fontFamily: FONTS.body, color: COLORS.text}}>
                Inkweave — Master Lorcana Synergies
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Usage Guide */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Usage Guide</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '100px 1fr',
            gap: '8px 16px',
            color: COLORS.text,
            fontSize: FONT_SIZES.base,
            fontFamily: FONTS.body,
          }}>
          <code style={{color: COLORS.primary500}}>xxxl (22)</code>
          <span style={{color: COLORS.textMuted}}>Reserved — rarely used</span>
          <code style={{color: COLORS.primary500}}>xxl (20)</code>
          <span style={{color: COLORS.textMuted}}>Page titles, card names, hero names</span>
          <code style={{color: COLORS.primary500}}>xl (16)</code>
          <span style={{color: COLORS.textMuted}}>Section headings, group titles</span>
          <code style={{color: COLORS.primary500}}>lg (14)</code>
          <span style={{color: COLORS.textMuted}}>Search inputs only (form exception)</span>
          <code style={{color: COLORS.primary500}}>base (13)</code>
          <span style={{color: COLORS.textMuted}}>Most UI text — chips, labels, descriptions</span>
          <code style={{color: COLORS.primary500}}>md (12)</code>
          <span style={{color: COLORS.textMuted}}>Compact labels, secondary info</span>
          <code style={{color: COLORS.primary500}}>sm (11)</code>
          <span style={{color: COLORS.textMuted}}>Small labels, metadata</span>
          <code style={{color: COLORS.primary500}}>xs (10)</code>
          <span style={{color: COLORS.textMuted}}>Badges, count circles, hover cues</span>
        </div>
      </section>

      {/* Text Colors */}
      <section style={{marginBottom: 32}}>
        <h2 style={sectionHeading}>Text Color Palette</h2>
        <p
          style={{
            color: COLORS.textMuted,
            fontSize: FONT_SIZES.base,
            fontFamily: FONTS.body,
            margin: '0 0 16px',
          }}>
          4-color system, all WCAG AA on dark backgrounds. Hierarchy via weight/case/color, not
          pixel nudges.
        </p>
        <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
          {[
            {
              color: COLORS.text,
              label: '#e8e8e8 — Primary',
              desc: 'Card names, headings, active UI',
            },
            {
              color: COLORS.textMuted,
              label: '#90a1b9 — Muted',
              desc: 'Labels, counts, secondary info',
            },
            {
              color: COLORS.primary500,
              label: '#d4af37 — Gold',
              desc: 'Brand, accents, active states, CTAs',
            },
            {
              color: COLORS.descriptionText,
              label: '#c8c8d8 — Description',
              desc: 'Supplementary/educational content',
            },
          ].map((t) => (
            <div key={t.label} style={{display: 'flex', alignItems: 'center', gap: 16}}>
              <span
                style={{
                  color: t.color,
                  fontSize: 16,
                  fontWeight: 600,
                  fontFamily: FONTS.body,
                  minWidth: 260,
                }}>
                {t.label}
              </span>
              <span
                style={{
                  color: COLORS.textMuted,
                  fontSize: FONT_SIZES.base,
                  fontFamily: FONTS.body,
                }}>
                {t.desc}
              </span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ── Story config ─────────────────────────────────────────────────────

const meta: Meta = {
  title: 'Design System/Typography',
  tags: ['autodocs'],
  parameters: {layout: 'fullscreen'},
};
export default meta;

type Story = StoryObj;

export const Scale: Story = {
  render: () => <TypeScale />,
};
