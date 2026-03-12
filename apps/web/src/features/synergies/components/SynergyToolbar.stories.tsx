import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {SynergySortOrder} from '../../../shared/constants';
import type {SynergyFilterState} from '../utils/filterSynergyCards';
import {EMPTY_SYNERGY_FILTERS} from '../utils/filterSynergyCards';
import {SynergyToolbar} from './SynergyToolbar';

const mockSets = [
  {code: '5', name: 'Shimmering Skies'},
  {code: '6', name: 'Azurite Sea'},
  {code: '7', name: 'Archazia'},
];

const meta: Meta<typeof SynergyToolbar> = {
  title: 'Features/SynergyToolbar',
  component: SynergyToolbar,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{padding: 24, maxWidth: 800}}>
        <Story />
      </div>
    ),
  ],
  args: {
    filterState: EMPTY_SYNERGY_FILTERS,
    onFilterChange: fn(),
    sortOrder: 'ink-cost' as SynergySortOrder,
    onSortChange: fn(),
    isMobile: false,
    uniqueKeywords: ['Evasive', 'Rush', 'Singer', 'Shift', 'Ward'],
    uniqueClassifications: ['Floodborn', 'Dreamborn', 'Storyborn'],
    sets: mockSets,
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const WithActiveFilters: Story = {
  args: {
    filterState: {
      ...EMPTY_SYNERGY_FILTERS,
      inkFilters: ['Sapphire', 'Amethyst'],
      typeFilters: ['Character'],
      strengthFilters: ['Strong'],
    },
  },
};

export const Mobile: Story = {
  args: {isMobile: true},
  decorators: [
    (Story) => (
      <div style={{padding: 16, maxWidth: 390}}>
        <Story />
      </div>
    ),
  ],
};

export const MobileWithFilters: Story = {
  args: {
    isMobile: true,
    filterState: {
      ...EMPTY_SYNERGY_FILTERS,
      inkFilters: ['Ruby'],
      typeFilters: ['Action'],
      strengthFilters: ['Moderate'],
    },
  },
  decorators: [
    (Story) => (
      <div style={{padding: 16, maxWidth: 390}}>
        <Story />
      </div>
    ),
  ],
};

export const Interactive: Story = {
  render: (args) => {
    const [filterState, setFilterState] = useState<SynergyFilterState>(EMPTY_SYNERGY_FILTERS);
    const [sortOrder, setSortOrder] = useState<SynergySortOrder>('ink-cost');

    return (
      <div style={{padding: 24, maxWidth: 800}}>
        <SynergyToolbar
          {...args}
          filterState={filterState}
          onFilterChange={setFilterState}
          sortOrder={sortOrder}
          onSortChange={setSortOrder}
        />
      </div>
    );
  },
};
