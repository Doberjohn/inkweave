import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {FilterDrawer} from './FilterDrawer';

const meta: Meta<typeof FilterDrawer> = {
  title: 'Components/FilterDrawer',
  component: FilterDrawer,
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onClose: fn(),
    onToggleInk: fn(),
    onToggleType: fn(),
    onToggleCost: fn(),
    onFiltersChange: fn(),
    onClearAll: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    isOpen: true,
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    uniqueKeywords: ['Singer', 'Evasive', 'Ward', 'Bodyguard', 'Challenger', 'Rush'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain', 'Floodborn', 'Storyborn'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '2', name: 'Rise of the Floodborn', number: 2},
      {code: '3', name: 'Into the Inklands', number: 3},
      {code: '4', name: "Ursula's Return", number: 4},
      {code: '5', name: 'Shimmering Skies', number: 5},
      {code: '6', name: 'Azurite Sea', number: 6},
    ],
  },
};

export const WithActiveFilters: Story = {
  args: {
    isOpen: true,
    inkFilters: ['Sapphire'],
    typeFilters: ['Character'],
    costFilters: [3, 4, 5, 6],
    filters: {
      keywords: ['Singer'],
    },
    uniqueKeywords: ['Singer', 'Evasive', 'Ward', 'Bodyguard'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '5', name: 'Shimmering Skies', number: 5},
      {code: '6', name: 'Azurite Sea', number: 6},
    ],
  },
};

export const Closed: Story = {
  args: {
    isOpen: false,
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    uniqueKeywords: [],
    uniqueClassifications: [],
    sets: [],
  },
};
