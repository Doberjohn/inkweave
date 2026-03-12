import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {BrowseToolbar} from './BrowseToolbar';

const noopFilters = {
  onFiltersClick: fn(),
  onToggleInk: fn(),
  onToggleType: fn(),
  onToggleCost: fn(),
  onFiltersChange: fn(),
  onClearAll: fn(),
  onSortChange: fn(),
};

const meta: Meta<typeof BrowseToolbar> = {
  title: 'Features/BrowseToolbar',
  component: BrowseToolbar,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    ...noopFilters,
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    activeFilterCount: 0,
    sortOrder: 'name-asc',
    isMobile: false,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const NoFilters: Story = {};

export const WithActiveFilters: Story = {
  args: {
    inkFilters: ['Sapphire', 'Amethyst'],
    typeFilters: ['Character'],
    costFilters: [3, 5],
    activeFilterCount: 5,
  },
};

export const Mobile: Story = {
  args: {
    isMobile: true,
    inkFilters: ['Ruby'],
    activeFilterCount: 1,
  },
};

export const MobileWithChips: Story = {
  args: {
    isMobile: true,
    inkFilters: ['Ruby', 'Emerald'],
    typeFilters: ['Action'],
    activeFilterCount: 3,
  },
};
