import type {Meta, StoryObj} from '@storybook/react-vite';
import {RarityBreakdown} from './RarityBreakdown';

const meta: Meta<typeof RarityBreakdown> = {
  title: 'Features/Reveals/RarityBreakdown',
  component: RarityBreakdown,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Partial: Story = {
  args: {rarityCounts: {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 1}},
};

export const Complete: Story = {
  args: {rarityCounts: {common: 12, uncommon: 9, rare: 8, 'super rare': 3, legendary: 2}},
};

export const Mobile: Story = {
  args: {rarityCounts: {common: 4, uncommon: 3, rare: 2, 'super rare': 1, legendary: 0}, compact: true},
};

export const RaritySelected: Story = {
  args: {
    rarityCounts: {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 1},
    selectedRarity: 'rare',
    onSelectRarity: () => {},
  },
};
