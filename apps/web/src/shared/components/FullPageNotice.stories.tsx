import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS, FONTS, FONT_SIZES} from '../constants';
import {FullPageNotice} from './FullPageNotice';

const meta: Meta<typeof FullPageNotice> = {
  title: 'Shared/FullPageNotice',
  component: FullPageNotice,
  tags: ['autodocs'],
  args: {onCta: fn(), ctaLabel: 'Return to Inkweave'},
};
export default meta;
type Story = StoryObj<typeof meta>;

// Title-first, the shape the off-season /reveals notice uses: no hero mark, so the
// title carries the page's h1.
export const TitleFirst: Story = {
  args: {
    titleLevel: 1,
    title: 'Reveal season has ended',
    lines: [
      'Attack of the Vine! released on 24 July 2026.',
      'The spoiler board is closed until the next set.',
    ],
  },
};

// With a hero mark, as the 404 uses it. The numeral is sized at the top of the
// type scale rather than the 404's own clamp(100px, 20vw, 180px): no token
// expresses a responsive hero numeral, and a story does not need pixel fidelity
// to show what the slot is for.
export const WithHero: Story = {
  args: {
    hero: (
      <h1
        style={{
          margin: 0,
          fontFamily: FONTS.hero,
          fontSize: FONT_SIZES.displayLg,
          lineHeight: 1,
          letterSpacing: 8,
          color: COLORS.primary,
        }}>
        404
      </h1>
    ),
    title: 'Lost in the Inkwell',
    lines: [
      'This page has vanished into the mists of Lorcana.',
      'Perhaps it was banished, or simply never existed.',
    ],
  },
};
