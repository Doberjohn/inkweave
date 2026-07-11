import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {DeckStats} from '../types';
import {DeckPanel, type DeckRow} from './DeckPanel';

const RB = 'https://api.lorcana.ravensburger.com/images/en';

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

// A type-diverse deck so the panel's grouping (Characters / Actions / Songs /
// Items / Locations) and the mix of inks / inkable states are visible.
const rows: DeckRow[] = [
  {card: card('c1', {fullName: 'The Queen - Conceited Ruler', cost: 3, ink: 'Amber', inkwell: true, type: 'Character', imageUrl: `${RB}/set9/1_93b7a7794fa098c50d7f82e099a8db3928a78f9d.jpg`}), quantity: 4},
  {card: card('c2', {fullName: 'Kuzco - Temperamental Emperor', cost: 5, ink: 'Emerald', inkwell: true, type: 'Character', imageUrl: `${RB}/set9/69_a6126f19afa4cc53460116f2aaa51732adceaa05.jpg`}), quantity: 1},
  {card: card('c3', {fullName: 'Anna - True-Hearted', cost: 4, ink: 'Sapphire', inkwell: false, type: 'Character', imageUrl: `${RB}/set9/137_30b03ce9b58be1bc220632827d7d72051fe68876.jpg`}), quantity: 4},
  {card: card('a1', {fullName: "Bruno's Return", cost: 2, ink: 'Amber', inkwell: false, type: 'Action', imageUrl: `${RB}/set9/29_6c5411527a850fe20562f4f0cd4ea8e9f0a2a588.jpg`}), quantity: 2},
  {card: card('s1', {fullName: 'Heal What Has Been Hurt', cost: 3, ink: 'Amber', inkwell: true, type: 'Action', isSong: true, imageUrl: `${RB}/set9/27_9a6cbaef607009caebe172473534c1520b85b4b9.jpg`}), quantity: 3},
  {card: card('i1', {fullName: 'Lantern', cost: 2, ink: 'Amber', inkwell: false, type: 'Item', imageUrl: `${RB}/set9/32_c4b56c9ae7915c4401bd6946eaa828caa5478ee4.jpg`}), quantity: 2},
  {card: card('l1', {fullName: 'Atlantica - Concert Hall', cost: 1, ink: 'Amber', inkwell: true, type: 'Location', imageUrl: `${RB}/set9/34_ee0d239951bc0f6e7f54b327711424dcf0716a24.jpg`}), quantity: 1},
];

const stats = (over: Partial<DeckStats> = {}): DeckStats => ({
  totalCards: 17,
  uniqueCards: 7,
  inkDistribution: {Amber: 12, Emerald: 1, Sapphire: 4},
  costCurve: {1: 1, 2: 4, 3: 7, 4: 4, 5: 1},
  costCurveByInk: {
    1: {Amber: 1},
    2: {Amber: 3, Sapphire: 1},
    3: {Amber: 5, Sapphire: 2},
    4: {Amber: 3, Sapphire: 1},
    5: {Emerald: 1},
  },
  typeDistribution: {Character: 9, Action: 5, Item: 2, Location: 1},
  inkCount: 3,
  inkableCount: 8,
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
      <div style={{height: 680, width: 520}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {onRename: fn(), onIncrement: fn(), onDecrement: fn(), onRemove: fn(), onOpenDetails: fn()},
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
      costCurveByInk: {},
      typeDistribution: {},
      inkCount: 0,
      inkableCount: 0,
    }),
  },
};

export const Building: Story = {args: {name: 'Amber Midrange', rows, stats: stats()}};

export const Legal: Story = {args: {name: 'Amber Midrange', rows, stats: stats({totalCards: 60, inkCount: 2, isLegal: true})}};

export const Illegal: Story = {
  args: {
    name: 'Three Inks',
    rows,
    stats: stats({totalCards: 60, inkCount: 3, legalityErrors: ['3 inks: Amber, Emerald, Sapphire (max 2)']}),
  },
};
