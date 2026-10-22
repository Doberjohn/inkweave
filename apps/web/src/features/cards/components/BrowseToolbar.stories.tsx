import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {BrowseToolbar} from './BrowseToolbar';
import {CollectionModeSwitch} from '../../collection/CollectionModeSwitch';
import {BINDER_SORT_OPTIONS} from '../../collection/binderCards';

const noopFilters = {
  onFiltersClick: fn(),
  onToggleInk: fn(),
  onToggleType: fn(),
  onToggleCost: fn(),
  onClearCosts: fn(),
  onFiltersChange: fn(),
  onSortChange: fn(),
  onSearchChange: fn(),
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
    searchQuery: '',
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

/**
 * Browse on desktop, docked over the side panel (owner, 2026-10-08): Filters and the sort
 * span the panel's width, the search starts where the cards do, Collection takes the far
 * end. The panel shows the filters, so Filters is filled; collection mode is off.
 */
export const Docked: Story = {
  args: {
    docked: {panelOpen: true},
    modeSwitch: <CollectionModeSwitch active={false} onToggle={fn()} />,
    typeFilters: ['Character'],
    activeFilterCount: 1,
  },
};

/** A search typed in: the clear button sits at the field's right end until it is emptied. */
export const DockedWithSearch: Story = {
  args: {...Docked.args, searchQuery: 'Elsa'},
};

/** The panel closed: Filters turns to its outline, and the active filters show as chips underneath. */
export const DockedPanelClosed: Story = {
  args: {...Docked.args, docked: {panelOpen: false}},
};

/**
 * Collection mode with the filters open: both toggles filled, and the sort in its Browse
 * place. The binder's pockets follow it, so its default reads as what it is there: collector order.
 */
export const DockedCollectionMode: Story = {
  args: {
    ...Docked.args,
    docked: {panelOpen: true},
    modeSwitch: <CollectionModeSwitch active onToggle={fn()} />,
    sortOrder: 'newest',
    sortOptions: BINDER_SORT_OPTIONS,
  },
};
