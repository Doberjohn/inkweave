import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {VoteStatusBanner} from './VoteStatusBanner';

const meta = {
  title: 'Voting/VoteStatusBanner',
  component: VoteStatusBanner,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof VoteStatusBanner>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RateLimited: Story = {
  args: {
    type: 'rate_limited',
  },
};

export const Unavailable: Story = {
  args: {
    type: 'unavailable',
  },
};

export const Error: Story = {
  args: {
    type: 'error',
  },
};

export const ErrorWithRetry: Story = {
  args: {
    type: 'error',
    onRetry: fn(),
  },
};
