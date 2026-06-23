import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {FranchiseTier} from './FranchiseTier';
import type {RevealTier} from './useRevealCards';

function make(id: string, name: string, overrides: Partial<LorcanaCard> = {}): LorcanaCard {
  return {
    id,
    name,
    version: '',
    fullName: name,
    cost: 3,
    ink: 'Amber',
    inkwell: true,
    type: 'Character',
    classifications: [],
    keywords: [],
    text: '',
    strength: 2,
    willpower: 2,
    lore: 1,
    imageUrl: '',
    setCode: '13',
    setNumber: 1,
    ...overrides,
  };
}

const monstersIncTier: RevealTier = {
  id: 'monsters-inc',
  label: 'Monsters, Inc.',
  logoUrl: '/art/franchises/monsters-inc.webp',
  cards: Array.from({length: 12}, (_, i) => make(`t${i}`, `Toy ${i}`, {ink: 'Amber'})),
};

const oneCardTier: RevealTier = {
  id: 'turning-red',
  label: 'Turning Red',
  logoUrl: '/art/franchises/turning-red.webp',
  cards: [make('b1', 'Mei', {ink: 'Ruby'})],
};

const emptyTier: RevealTier = {
  id: 'returning',
  label: 'Returning franchises in Attack of the Vine!',
  cards: [],
};

const meta: Meta<typeof FranchiseTier> = {
  title: 'Features/Reveals/FranchiseTier',
  component: FranchiseTier,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <MemoryRouter>
        <Story />
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const MonstersIncTier: Story = {args: {tier: monstersIncTier, priorityCount: 6}};
export const OneCardTier: Story = {args: {tier: oneCardTier}};
export const EmptyTier: Story = {args: {tier: emptyTier}};
