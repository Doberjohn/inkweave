import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardGrid} from './CardGrid';
import type {LorcanaCard} from '../types';

const createMockCard = (overrides: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '1',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 5,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  classifications: ['Floodborn', 'Princess'],
  keywords: ['Singer 5', 'Evasive'],
  text: 'When you play this character, draw 2 cards.',
  strength: 3,
  willpower: 4,
  lore: 2,
  imageUrl: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
  setCode: '1',
  setNumber: 42,
  ...overrides,
});

const inks = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const;
const mockCards: LorcanaCard[] = Array.from({length: 12}, (_, i) =>
  createMockCard({
    id: `${i + 1}`,
    name: `${inks[i % inks.length]} Card ${i + 1}`,
    ink: inks[i % inks.length],
    cost: (i % 9) + 1,
  }),
);

const meta: Meta<typeof CardGrid> = {
  title: 'Cards/CardGrid',
  component: CardGrid,
  decorators: [
    (Story) => (
      <div style={{width: '100%', maxWidth: 1280, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
  },
  tags: ['autodocs'],
  args: {
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    cards: mockCards,
  },
};

export const MinimalVariant: Story = {
  args: {
    cards: mockCards,
    variant: 'minimal',
  },
};

export const Empty: Story = {
  args: {
    cards: [],
    emptyMessage: 'No cards match your filters.',
  },
};

export const FewCards: Story = {
  args: {
    cards: mockCards.slice(0, 3),
  },
};

export const ManyCards: Story = {
  args: {
    cards: Array.from({length: 30}, (_, i) =>
      createMockCard({
        id: `${i + 1}`,
        name: `${inks[i % inks.length]} Card ${i + 1}`,
        ink: inks[i % inks.length],
        cost: (i % 9) + 1,
      }),
    ),
  },
};
