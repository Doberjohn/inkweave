import type {Meta, StoryObj} from '@storybook/react-vite';
import {VoteProgress} from './VoteProgress';

const meta = {
  title: 'Voting/VoteProgress',
  component: VoteProgress,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta<typeof VoteProgress>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    voted: 12,
    skipped: 3,
  },
};

export const Empty: Story = {
  args: {
    voted: 0,
    skipped: 0,
  },
};
