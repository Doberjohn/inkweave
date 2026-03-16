import type {Meta, StoryObj} from '@storybook/react-vite';
import {TierCircle} from './TierCircle';

const strongTier = {
  label: 'Strong' as const,
  shortLabel: 'Strong',
  color: '#6ee7a0',
  bg: '#1a3d1a',
};

const meta: Meta<typeof TierCircle> = {
  title: 'Components/TierCircle',
  component: TierCircle,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof TierCircle>;

export const SmallCircle: Story = {
  args: {tier: strongTier, size: 'sm', children: 3},
};

export const MediumCircle: Story = {
  args: {tier: strongTier, size: 'md', children: 12},
};
