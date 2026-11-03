import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS, RADIUS, SPACING} from '../../../shared/constants';
import {LoadFailedNotice} from './LoadFailedNotice';

/** The notice a failed load leaves, in each of the places it takes. */
const meta: Meta<typeof LoadFailedNotice> = {
  title: 'Synergies/LoadFailedNotice',
  component: LoadFailedNotice,
  parameters: {layout: 'centered'},
  args: {onRetry: fn(), focusOnRetry: {current: null}},
};

export default meta;
type Story = StoryObj<typeof LoadFailedNotice>;

/** In place of a card's synergies, at the card window's column width. */
export const Stacked: Story = {
  args: {what: "this card's synergies", layout: 'stacked'},
  decorators: [
    (Story) => (
      <div style={{width: 420, height: 320, display: 'flex', background: COLORS.surface, borderRadius: RADIUS.card}}>
        <Story />
      </div>
    ),
  ],
};

/** In place of a playstyle's row of mechanic tiles. */
export const Inline: Story = {
  args: {what: "this playstyle's mechanics", layout: 'inline', style: {padding: SPACING.xl}},
  decorators: [
    (Story) => (
      <div style={{width: 900, background: COLORS.background}}>
        <Story />
      </div>
    ),
  ],
};
