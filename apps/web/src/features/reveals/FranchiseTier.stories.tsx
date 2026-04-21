import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardPreviewProvider} from '../cards';
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
    setCode: '12',
    setNumber: 1,
    ...overrides,
  };
}

const toyStoryTier: RevealTier = {
  id: 'toy-story',
  label: 'Toy Story',
  logoUrl: '/art/franchises/toy-story.webp',
  cards: Array.from({length: 12}, (_, i) => make(`t${i}`, `Toy ${i}`, {ink: 'Amber'})),
};

const oneCardTier: RevealTier = {
  id: 'brave',
  label: 'Brave',
  logoUrl: '/art/franchises/brave.webp',
  cards: [make('b1', 'Merida', {ink: 'Emerald'})],
};

const emptyTier: RevealTier = {
  id: 'returning',
  label: 'Returning franchises in Wilds Unknown',
  cards: [],
};

const meta: Meta<typeof FranchiseTier> = {
  title: 'Features/Reveals/FranchiseTier',
  component: FranchiseTier,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <MemoryRouter>
        <CardPreviewProvider>
          <Story />
        </CardPreviewProvider>
      </MemoryRouter>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const ToyStoryTier: Story = {args: {tier: toyStoryTier, priorityCount: 6}};
export const OneCardTier: Story = {args: {tier: oneCardTier}};
export const EmptyTier: Story = {args: {tier: emptyTier}};
