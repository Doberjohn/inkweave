import type { Meta, StoryObj } from '@storybook/react-vite';
import { fn } from 'storybook/test';
import { FilterDrawer } from './FilterDrawer';

const meta: Meta<typeof FilterDrawer> = {
  title: 'Components/FilterDrawer',
  component: FilterDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
    onInkFilterChange: fn(),
    onFiltersChange: fn(),
    onClearAll: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    inkFilter: 'all',
    filters: {},
    uniqueKeywords: ['Singer', 'Evasive', 'Ward', 'Bodyguard', 'Challenger', 'Rush'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain', 'Floodborn', 'Storyborn'],
    sets: [
      { code: '1', name: 'The First Chapter', number: 1 },
      { code: '2', name: 'Rise of the Floodborn', number: 2 },
      { code: '3', name: 'Into the Inklands', number: 3 },
      { code: '4', name: 'Ursula\'s Return', number: 4 },
      { code: '5', name: 'Shimmering Skies', number: 5 },
      { code: '6', name: 'Azurite Sea', number: 6 },
    ],
  },
};

export const WithActiveFilters: Story = {
  args: {
    isOpen: true,
    inkFilter: 'Sapphire',
    filters: {
      type: 'Character',
      minCost: 3,
      maxCost: 6,
      keywords: ['Singer'],
    },
    uniqueKeywords: ['Singer', 'Evasive', 'Ward', 'Bodyguard'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    sets: [
      { code: '1', name: 'The First Chapter', number: 1 },
      { code: '5', name: 'Shimmering Skies', number: 5 },
      { code: '6', name: 'Azurite Sea', number: 6 },
    ],
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    inkFilter: 'all',
    filters: {},
    uniqueKeywords: [],
    uniqueClassifications: [],
    sets: [],
  },
};
