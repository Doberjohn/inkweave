import type {Meta, StoryObj} from '@storybook/react-vite';
import {RarityBreakdown} from './RarityBreakdown';
import {SPECIAL_RARITIES} from './rarity';

const meta: Meta<typeof RarityBreakdown> = {
  title: 'Features/Reveals/RarityBreakdown',
  component: RarityBreakdown,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Partial: Story = {
  args: {rarityCounts: {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 1}, onSelectRarity: () => {}},
};

export const Complete: Story = {
  args: {rarityCounts: {common: 12, uncommon: 9, rare: 8, 'super rare': 3, legendary: 2}, onSelectRarity: () => {}},
};

/** Legendary has nothing revealed yet, so it gets no chip. */
export const Mobile: Story = {
  args: {
    rarityCounts: {common: 4, uncommon: 3, rare: 2, 'super rare': 1, legendary: 0},
    compact: true,
    onSelectRarity: () => {},
  },
};

export const RaritySelected: Story = {
  args: {
    rarityCounts: {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 1},
    selectedRarity: 'rare',
    onSelectRarity: () => {},
  },
};

/** The board's special printing rarities follow the five; Epic has none revealed, so no chip. */
export const WithSpecialPrintings: Story = {
  args: {
    rarityCounts: {common: 8, uncommon: 8, rare: 6, 'super rare': 3, legendary: 2, enchanted: 2, iconic: 1},
    specialRarities: [SPECIAL_RARITIES.Epic, SPECIAL_RARITIES.Enchanted, SPECIAL_RARITIES.Iconic],
    onSelectRarity: () => {},
  },
};
