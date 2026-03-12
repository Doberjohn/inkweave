import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardTypeFilter} from '../constants';
import {FilterContent} from './FilterContent';

const noopHandlers = {
  onToggleInk: fn(),
  onToggleType: fn(),
  onToggleCost: fn(),
  onFiltersChange: fn(),
};

const mockSets = [
  {code: '5', name: 'Shimmering Skies'},
  {code: '6', name: 'Azurite Sea'},
  {code: '7', name: 'Archazia'},
];

const meta: Meta<typeof FilterContent> = {
  title: 'Shared/FilterContent',
  component: FilterContent,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 400, background: '#1a1a2e', padding: 24, borderRadius: 8}}>
        <Story />
      </div>
    ),
  ],
  args: {
    ...noopHandlers,
    inkFilters: [],
    typeFilters: [],
    costFilters: [],
    filters: {},
    uniqueKeywords: ['Evasive', 'Rush', 'Singer', 'Shift', 'Ward'],
    uniqueClassifications: ['Floodborn', 'Dreamborn', 'Storyborn'],
    sets: mockSets,
    variant: 'desktop',
  },
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Desktop: Story = {};

export const Mobile: Story = {
  args: {variant: 'mobile'},
  decorators: [
    (Story) => (
      <div style={{width: 340, background: '#1a1a2e', padding: 16, borderRadius: 8}}>
        <Story />
      </div>
    ),
  ],
};

export const WithActiveFilters: Story = {
  args: {
    inkFilters: ['Sapphire', 'Amethyst'] as Ink[],
    typeFilters: ['Character'] as CardTypeFilter[],
    costFilters: [3, 5],
    filters: {keywords: ['Singer']},
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [inks, setInks] = useState<Ink[]>([]);
    const [types, setTypes] = useState<CardTypeFilter[]>([]);
    const [costs, setCosts] = useState<number[]>([]);

    return (
      <div style={{width: 400, background: '#1a1a2e', padding: 24, borderRadius: 8}}>
        <FilterContent
          {...args}
          inkFilters={inks}
          typeFilters={types}
          costFilters={costs}
          onToggleInk={(ink) =>
            setInks((prev) => (prev.includes(ink) ? prev.filter((i) => i !== ink) : [...prev, ink]))
          }
          onToggleType={(type) =>
            setTypes((prev) =>
              prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type],
            )
          }
          onToggleCost={(cost) =>
            setCosts((prev) =>
              prev.includes(cost) ? prev.filter((c) => c !== cost) : [...prev, cost],
            )
          }
        />
      </div>
    );
  },
};
