import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS, RADIUS} from '../../../shared/constants';
import {OutsideCoreNotice, SynergiesEmptyState, SynergiesFailedNotice} from './SynergiesNotices';

/** The notices that take a card's synergy column, at the card window's column width. */
const meta: Meta<typeof SynergiesFailedNotice> = {
  title: 'Synergies/SynergiesNotices',
  component: SynergiesFailedNotice,
  parameters: {layout: 'centered'},
  decorators: [
    (Story) => (
      <div style={{width: 420, height: 320, display: 'flex', background: COLORS.surface, borderRadius: RADIUS.card}}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof SynergiesFailedNotice>;

export const Failed: Story = {
  args: {onRetry: fn(), focusOnRetry: {current: null}},
};

export const NoSynergies: Story = {
  render: () => <SynergiesEmptyState />,
};

export const OutsideCore: Story = {
  render: () => <OutsideCoreNotice />,
};
