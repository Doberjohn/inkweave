import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardFilterDialog} from './CardFilterDialog';

const mockSets = [
  {code: '5', name: 'Shimmering Skies', number: 5},
  {code: '6', name: 'Azurite Sea', number: 6},
  {code: '7', name: 'Archazia', number: 7},
];

const baseArgs = {
  isOpen: true,
  onClose: fn(),
  onApply: fn(),
  inkFilters: [],
  typeFilters: [],
  costFilters: [],
  filters: {},
  uniqueKeywords: ['Evasive', 'Rush', 'Singer', 'Shift', 'Ward'],
  uniqueClassifications: ['Floodborn', 'Dreamborn', 'Storyborn'],
  uniqueRarities: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'],
  sets: mockSets,
};

const meta: Meta<typeof CardFilterDialog> = {
  title: 'Shared/FilterDialog',
  component: CardFilterDialog,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {...baseArgs, variant: 'modal'},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Modal: Story = {};

export const Drawer: Story = {
  args: {variant: 'drawer'},
};

export const ModalWithActiveFilters: Story = {
  args: {
    inkFilters: ['Sapphire', 'Amethyst'],
    typeFilters: ['Character'],
    costFilters: [3, 5],
  },
};

export const Closed: Story = {
  args: {isOpen: false},
};
