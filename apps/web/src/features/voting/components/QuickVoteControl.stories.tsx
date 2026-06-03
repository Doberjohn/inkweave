import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {QuickVoteControl} from './QuickVoteControl';

const meta = {
  title: 'Voting/QuickVoteControl',
  component: QuickVoteControl,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
  args: {onVote: fn(), distributionLoading: false},
} satisfies Meta<typeof QuickVoteControl>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Ready: Story = {
  args: {state: 'ready', distribution: null, userChoice: null, error: null},
};

export const ReadyWithDistributionLoading: Story = {
  args: {state: 'ready', distribution: null, distributionLoading: true, userChoice: null, error: null},
};

export const Submitting: Story = {
  args: {state: 'submitting', distribution: null, userChoice: 0, error: null},
};

export const Result: Story = {
  args: {
    state: 'result',
    distribution: {lower: 15, right: 68, higher: 17, total: 100},
    userChoice: 0,
    error: null,
  },
};

export const ResultFirstVoter: Story = {
  args: {
    state: 'result',
    distribution: {lower: 0, right: 1, higher: 0, total: 1},
    userChoice: 0,
    error: null,
  },
};

export const Error: Story = {
  args: {state: 'error', distribution: null, userChoice: null, error: 'submission_failed'},
};

export const RateLimited: Story = {
  args: {state: 'error', distribution: null, userChoice: null, error: 'rate_limited'},
};

export const Mobile: Story = {
  args: {state: 'ready', distribution: null, userChoice: null, error: null},
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};

export const MobileResult: Story = {
  args: {
    state: 'result',
    distribution: {lower: 8, right: 30, higher: 12, total: 50},
    userChoice: 1,
    error: null,
  },
  parameters: {viewport: {defaultViewport: 'mobile1'}},
};
