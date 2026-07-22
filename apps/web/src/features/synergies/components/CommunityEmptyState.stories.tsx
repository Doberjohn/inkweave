import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CommunityEmptyState} from './CommunityEmptyState';

const meta: Meta<typeof CommunityEmptyState> = {
  title: 'Synergies/CommunityEmptyState',
  component: CommunityEmptyState,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 320, padding: 24, background: '#1a1a2e', borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
  args: {onCta: fn()},
};

export default meta;
type Story = StoryObj<typeof CommunityEmptyState>;

export const FullEmpty: Story = {
  args: {variant: 'full-empty', current: 3, threshold: 5},
};

export const FullEmptyZero: Story = {
  args: {variant: 'full-empty', current: 0, threshold: 5},
};

export const HalfEmpty: Story = {
  args: {variant: 'half-empty', current: 2, threshold: 5},
};

export const NearlyComplete: Story = {
  args: {variant: 'half-empty', current: 4, threshold: 5},
};
