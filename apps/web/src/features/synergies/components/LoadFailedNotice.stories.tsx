import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS, FONT_SIZES, FONT_WEIGHT, RADIUS, SPACING} from '../../../shared/constants';
import {LoadFailedNotice} from './LoadFailedNotice';

/** The line and Try again a failed load leaves, in the boxes of what they stand in for. */
const meta: Meta<typeof LoadFailedNotice> = {
  title: 'Synergies/LoadFailedNotice',
  component: LoadFailedNotice,
  parameters: {layout: 'centered'},
  args: {onRetry: fn(), focusOnRetry: {current: null}},
};

export default meta;
type Story = StoryObj<typeof LoadFailedNotice>;

/** In place of a card's synergies, at the card window's column width. */
export const InSynergyColumn: Story = {
  args: {
    what: "this card's synergies",
    lineStyle: {margin: 0, color: COLORS.text, fontSize: FONT_SIZES.lg, fontWeight: FONT_WEIGHT.semibold},
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 420,
          height: 320,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.md,
          background: COLORS.surface,
          borderRadius: RADIUS.card,
        }}
      >
        <Story />
      </div>
    ),
  ],
};

/** In place of a playstyle's row of mechanic tiles. */
export const InTileRow: Story = {
  args: {
    what: "this playstyle's mechanics",
    lineStyle: {margin: 0, color: COLORS.textMuted, fontSize: FONT_SIZES.lg},
  },
  decorators: [
    (Story) => (
      <div
        style={{
          width: 900,
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.md,
          padding: SPACING.xl,
          background: COLORS.background,
        }}
      >
        <Story />
      </div>
    ),
  ],
};
