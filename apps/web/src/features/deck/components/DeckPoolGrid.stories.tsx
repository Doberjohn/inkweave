import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {DeckPoolGrid} from './DeckPoolGrid';

const inks = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const;
const cards: LorcanaCard[] = Array.from({length: 18}, (_, i) => ({
  id: `${i + 1}`,
  name: `Card ${i + 1}`,
  fullName: `Card ${i + 1} - Hero`,
  cost: (i % 8) + 1,
  ink: inks[i % inks.length],
  inkwell: true,
  type: 'Character',
}));

const meta: Meta<typeof DeckPoolGrid> = {
  title: 'Deck/DeckPoolGrid',
  component: DeckPoolGrid,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{height: 560, width: '100%'}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onIncrement: fn(), onDecrement: fn(), onViewDetails: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const EmptyDeck: Story = {args: {cards, quantities: new Map()}};

// card 1 is at the 4-copy max (its + disables); card 5 shows a count pip.
export const WithDeckState: Story = {
  args: {
    cards,
    quantities: new Map([
      ['1', 4],
      ['5', 2],
    ]),
  },
};

export const NoResults: Story = {args: {cards: [], quantities: new Map()}};
