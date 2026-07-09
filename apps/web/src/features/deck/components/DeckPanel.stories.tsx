import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {DeckStats} from '../types';
import {DeckPanel, type DeckRow} from './DeckPanel';

const card = (id: string, over: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id,
  name: `Card ${id}`,
  fullName: `Card ${id} - Hero`,
  cost: 3,
  ink: 'Amber',
  inkwell: true,
  type: 'Character',
  ...over,
});

const rows: DeckRow[] = [
  {card: card('1', {cost: 1, fullName: 'Amber One'}), quantity: 4},
  {card: card('2', {cost: 3, fullName: 'Amber Two'}), quantity: 3},
  {card: card('3', {cost: 5, ink: 'Steel', fullName: 'Steel Three'}), quantity: 2},
];

const stats = (over: Partial<DeckStats> = {}): DeckStats => ({
  totalCards: 9,
  uniqueCards: 3,
  inkDistribution: {Amber: 7, Steel: 2},
  costCurve: {1: 4, 3: 3, 5: 2},
  typeDistribution: {Character: 9},
  inkCount: 2,
  inkableCount: 7,
  isLegal: false,
  legalityErrors: [],
  ...over,
});

const meta: Meta<typeof DeckPanel> = {
  title: 'Deck/DeckPanel',
  component: DeckPanel,
  parameters: {layout: 'fullscreen', backgrounds: {default: 'dark'}},
  decorators: [
    (Story) => (
      <div style={{height: 560, width: 420}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onRename: fn(), onIncrement: fn(), onDecrement: fn(), onRemove: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    name: 'Untitled deck',
    rows: [],
    stats: stats({
      totalCards: 0,
      uniqueCards: 0,
      inkDistribution: {},
      costCurve: {},
      typeDistribution: {},
      inkCount: 0,
      inkableCount: 0,
    }),
  },
};

export const Building: Story = {args: {name: 'Amber Aggro', rows, stats: stats()}};

export const Legal: Story = {args: {name: 'Amber Aggro', rows, stats: stats({totalCards: 60, isLegal: true})}};

export const Illegal: Story = {
  args: {
    name: 'Three Inks',
    rows,
    stats: stats({totalCards: 60, inkCount: 3, legalityErrors: ['3 inks: Amber, Ruby, Steel (max 2)']}),
  },
};
