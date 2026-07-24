import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {DeckCardRow} from './DeckCardRow';
import {COLORS} from '../../../shared/constants';

const card = (over: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '1',
  name: 'Mickey Mouse',
  fullName: 'Mickey Mouse - Brave Little Tailor',
  cost: 8,
  ink: 'Amber',
  inkwell: false,
  type: 'Character',
  ...over,
});

const meta: Meta<typeof DeckCardRow> = {
  title: 'Deck/DeckCardRow',
  component: DeckCardRow,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{width: 380, background: COLORS.surface, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onIncrement: fn(), onDecrement: fn(), onRemove: fn(), onSetCore: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {card: card(), quantity: 2}};

export const AtMaxCopies: Story = {args: {card: card(), quantity: 4}};

// Flagged a deck-core anchor: the star stays visible and gold with a soft glow
// (unmarked rows only reveal the outline star on hover).
export const Core: Story = {args: {card: card(), quantity: 3, isCore: true}};
