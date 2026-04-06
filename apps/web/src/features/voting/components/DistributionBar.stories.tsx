import type {Meta, StoryObj} from '@storybook/react-vite';
import {DistributionBar} from './DistributionBar';

const meta = {
  title: 'Voting/DistributionBar',
  component: DistributionBar,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 400, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof DistributionBar>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Balanced: Story = {
  args: {lower: 15, right: 68, higher: 17, animate: false},
};

export const Animated: Story = {
  args: {lower: 15, right: 68, higher: 17, animate: true},
};

export const Unanimous: Story = {
  args: {lower: 0, right: 25, higher: 0, animate: false},
};

export const Controversial: Story = {
  args: {lower: 12, right: 5, higher: 13, animate: false},
};

export const SingleVote: Story = {
  args: {lower: 0, right: 1, higher: 0, animate: false},
};
