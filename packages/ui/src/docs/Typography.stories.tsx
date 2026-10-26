import {Fragment} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {FONTS, FONT_SIZES, COLORS} from '../tokens/theme';

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

/** Muted copy: notes, values and descriptions. */
const mutedText: React.CSSProperties = {
  color: COLORS.textMuted,
  fontSize: FONT_SIZES.base,
  fontFamily: FONTS.body,
};

/** A source reference inside muted copy. */
const codeNote: React.CSSProperties = {color: COLORS.descriptionText};

const FONT_FAMILIES = [
  {token: 'FONTS.body', name: 'Plus Jakarta Sans', family: FONTS.body},
  {token: 'FONTS.hero', name: 'Marcellus (serif, 400 only)', family: FONTS.hero},
];

/** Each type-scale step and what it is for. */
const USAGE_GUIDE: ReadonlyArray<readonly [step: string, use: string]> = [
  ['xxxl (22)', 'Reserved, rarely used'],
  ['xxl (20)', 'Page titles, card names, hero names'],
  ['xl (16)', 'Section headings, group titles'],
  ['lg (14)', 'Search inputs only (form exception)'],
  ['base (13)', 'Most UI text: chips, labels, descriptions'],
  ['md (12)', 'Compact labels, secondary info'],
  ['sm (11)', 'Small labels, metadata'],
  ['xs (10)', 'Badges, count circles, hover cues'],
];

const TEXT_COLORS = [
  {color: COLORS.text, label: '#e8e8e8: Primary', desc: 'Card names, headings, active UI'},
  {color: COLORS.textMuted, label: '#90a1b9: Muted', desc: 'Labels, counts, secondary info'},
  {color: COLORS.primary500, label: '#d4af37: Gold', desc: 'Brand, accents, active states, CTAs'},
  {
    color: COLORS.descriptionText,
    label: '#c8c8d8: Description',
    desc: 'Supplementary/educational content',
  },
];

function Section({title, children}: {title: string; children: React.ReactNode}) {
  return (
    <section style={{marginBottom: 32}}>
      <h2 style={sectionHeading}>{title}</h2>
      {children}
    </section>
  );
}

// ── Sections ─────────────────────────────────────────────────────────

/** One font family: its token and name, then a sample line set in it. */
function FontSample({token, name, family}: {token: string; name: string; family: string}) {
  return (
    <div>
      <div style={{...mutedText, marginBottom: 8}}>
        <code style={codeNote}>{token}</code>: {name}
      </div>
      <div style={{fontSize: FONT_SIZES.xxl, fontFamily: family, color: COLORS.text}}>
        The quick brown fox jumps over the lazy dog
      </div>
    </div>
  );
}

function FontFamiliesSection() {
  return (
    <Section title="Font Families">
      <div style={{display: 'flex', flexDirection: 'column', gap: 24}}>
        {FONT_FAMILIES.map((font) => (
          <FontSample key={font.token} {...font} />
        ))}
      </div>
    </Section>
  );
}

function ScaleSection() {
  return (
    <Section title="Type Scale">
      <div style={{display: 'flex', flexDirection: 'column', gap: 0}}>
        {Object.entries(FONT_SIZES).map(([name, size]) => (
          <div
            key={name}
            style={{
              display: 'grid',
              gridTemplateColumns: '80px 50px 1fr',
              alignItems: 'baseline',
              padding: '12px 0',
              borderBottom: `1px solid ${COLORS.gray100}`,
            }}>
            <code style={tokenName}>{name}</code>
            <span style={mutedText}>{size}px</span>
            <span style={{fontSize: size, fontFamily: FONTS.body, color: COLORS.text}}>
              Inkweave: Master Lorcana Synergies
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}

function UsageGuideSection() {
  return (
    <Section title="Usage Guide">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '100px 1fr',
          gap: '8px 16px',
          color: COLORS.text,
          fontSize: FONT_SIZES.base,
          fontFamily: FONTS.body,
        }}>
        {USAGE_GUIDE.map(([step, use]) => (
          <Fragment key={step}>
            <code style={{color: COLORS.primary500}}>{step}</code>
            <span style={{color: COLORS.textMuted}}>{use}</span>
          </Fragment>
        ))}
      </div>
    </Section>
  );
}

function TextColorsSection() {
  return (
    <Section title="Text Color Palette">
      <p style={{...mutedText, margin: '0 0 16px'}}>
        4-color system, all WCAG AA on dark backgrounds. Hierarchy via weight/case/color, not pixel
        nudges.
      </p>
      <div style={{display: 'flex', flexDirection: 'column', gap: 16}}>
        {TEXT_COLORS.map((t) => (
          <div key={t.label} style={{display: 'flex', alignItems: 'center', gap: 16}}>
            <span
              style={{
                color: t.color,
                fontSize: FONT_SIZES.xl,
                fontWeight: 600,
                fontFamily: FONTS.body,
                minWidth: 260,
              }}>
              {t.label}
            </span>
            <span style={mutedText}>{t.desc}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── Type Scale ───────────────────────────────────────────────────────

function TypeScale() {
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
        Typography
      </h1>
      <p style={{...mutedText, margin: '0 0 32px'}}>
        Type scale and font families from <code style={codeNote}>inkweave-ui/tokens/theme.ts</code>.
        Based on a ~1.25 major third ratio with 13px base.
      </p>
      <FontFamiliesSection />
      <ScaleSection />
      <UsageGuideSection />
      <TextColorsSection />
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
