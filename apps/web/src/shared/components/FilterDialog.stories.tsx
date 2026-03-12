import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FilterDialog} from './FilterDialog';

const mockSets = [
  {code: '5', name: 'Shimmering Skies'},
  {code: '6', name: 'Azurite Sea'},
  {code: '7', name: 'Archazia'},
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
  sets: mockSets,
} as const;

const meta: Meta<typeof FilterDialog> = {
  title: 'Shared/FilterDialog',
  component: FilterDialog,
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
