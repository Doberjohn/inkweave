import type {Meta, StoryObj} from '@storybook/react-vite';
import {VoteFormSkeleton} from './VoteFormSkeleton';

const meta: Meta<typeof VoteFormSkeleton> = {
  title: 'Voting/VoteFormSkeleton',
  component: VoteFormSkeleton,
  parameters: {
    layout: 'fullscreen',
  },
  decorators: [
    (Story) => (
      <div style={{background: '#0d0d14', minHeight: '100vh', maxWidth: 520, margin: '0 auto'}}>
        <Story />
      </div>
    ),
  ],
};

export default meta;
type Story = StoryObj<typeof VoteFormSkeleton>;

export const Default: Story = {};

export const CompactThreeRows: Story = {
  args: {
    rows: 3,
  },
};
