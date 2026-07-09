import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {PoolCardTile} from './PoolCardTile';

// No imageUrl → CardTile renders its cost-box fallback, so the story is
// self-contained (no network) and still shows the +/pip/dim chrome.
const card = (over: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '1',
  name: 'Elsa',
  fullName: 'Elsa - Snow Queen',
  cost: 4,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  ...over,
});

const meta: Meta<typeof PoolCardTile> = {
  title: 'Deck/PoolCardTile',
  component: PoolCardTile,
  parameters: {backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{width: 170, padding: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onAdd: fn(), onViewDetails: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Addable: Story = {args: {card: card(), deckInks: ['Sapphire'], inDeckCount: 0}};

export const InDeck: Story = {args: {card: card(), deckInks: ['Sapphire'], inDeckCount: 2}};

export const AtMaxCopies: Story = {args: {card: card(), deckInks: ['Sapphire'], inDeckCount: 4}};

export const OffInk: Story = {args: {card: card({ink: 'Ruby'}), deckInks: ['Amber', 'Steel'], inDeckCount: 0}};
