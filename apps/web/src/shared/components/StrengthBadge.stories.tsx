import type {Meta, StoryObj} from '@storybook/react-vite';
import {StrengthBadge} from './StrengthBadge';

const tiers = {
  Perfect: {label: 'Perfect' as const, shortLabel: 'Perf', color: '#fbbf24', bg: '#3d3010'},
  Strong: {label: 'Strong' as const, shortLabel: 'Strong', color: '#6ee7a0', bg: '#1a3d1a'},
  Moderate: {label: 'Moderate' as const, shortLabel: 'Mod', color: '#60b5f5', bg: '#10253d'},
  Weak: {label: 'Weak' as const, shortLabel: 'Weak', color: '#f59090', bg: '#3d1a1a'},
};

const meta: Meta<typeof StrengthBadge> = {
  title: 'Components/StrengthBadge',
  component: StrengthBadge,
  parameters: {layout: 'centered', backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof StrengthBadge>;

export const Small: Story = {
  args: {tier: tiers.Strong, size: 'sm', children: 'Strong 7'},
};

export const Medium: Story = {
  args: {tier: tiers.Moderate, size: 'md', children: 'Moderate'},
};

export const Large: Story = {
  args: {tier: tiers.Perfect, size: 'lg', children: '10'},
};

export const AllTiers: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 8}}>
      {Object.values(tiers).map((tier) => (
        <StrengthBadge key={tier.label} tier={tier} size="sm">
          {tier.label} 7
        </StrengthBadge>
      ))}
    </div>
  ),
};
