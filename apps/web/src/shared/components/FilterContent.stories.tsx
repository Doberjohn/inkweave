import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardFilterOptions} from '../../features/cards';
import {COLORS, RADIUS, SPACING, type CardTypeFilter} from '../constants';
import {FilterContent} from './FilterContent';

const noopHandlers = {
  onToggleInk: fn(),
  onToggleType: fn(),
  onToggleCost: fn(),
  onFiltersChange: fn(),
};

const mockSets = [
  {code: '5', name: 'Shimmering Skies', number: 5},
  {code: '6', name: 'Azurite Sea', number: 6},
  {code: '7', name: 'Archazia', number: 7},
];

const meta: Meta<typeof FilterContent> = {
  title: 'Shared/FilterContent',
  component: FilterContent,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 400, background: COLORS.surface, padding: 24, borderRadius: RADIUS.lg}}>
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
    uniqueRarities: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'],
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
      <div style={{width: 340, background: COLORS.surface, padding: 16, borderRadius: RADIUS.lg}}>
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

/**
 * Browse's panel, either mode (owner, 2026-10-15): the rarities include the alt-art
 * printings, and the art presets sit under them. Live: a preset picks its kind's rarities,
 * and lights up while the picks are exactly those; pick any other rarity and it goes out.
 */
export const ArtPresets: Story = {
  args: {
    variant: 'panel',
    uniqueRarities: ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'],
    showArtPresets: true,
  },
  decorators: [
    (Story) => (
      <div style={{width: 260, background: COLORS.surface, padding: SPACING.md, borderRadius: RADIUS.card}}>
        <Story />
      </div>
    ),
  ],
  render: (args) => {
    const [filters, setFilters] = useState<CardFilterOptions>({});
    return <FilterContent {...args} filters={filters} onFiltersChange={setFilters} />;
  },
};

/**
 * Browse's panel with the promo printings (#805): LorcanaJSON's Special rarity shows the
 * promo symbol, named "Promo" for its tooltip and screen readers. Neither art preset picks it.
 */
export const WithPromos: Story = {
  ...ArtPresets,
  args: {
    ...ArtPresets.args,
    uniqueRarities: [
      'Common',
      'Uncommon',
      'Rare',
      'Super Rare',
      'Legendary',
      'Epic',
      'Enchanted',
      'Iconic',
      'Special',
    ],
  },
};

export const Interactive: Story = {
  render: (args) => {
    const [inks, setInks] = useState<Ink[]>([]);
    const [types, setTypes] = useState<CardTypeFilter[]>([]);
    const [costs, setCosts] = useState<number[]>([]);

    return (
      <div style={{width: 400, background: COLORS.surface, padding: 24, borderRadius: RADIUS.lg}}>
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
