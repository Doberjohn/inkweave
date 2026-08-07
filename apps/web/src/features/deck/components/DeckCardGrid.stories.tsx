import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {DeckCardGrid} from './DeckCardGrid';
import type {LorcanaCard} from '../types';

/** Real Core ids and hashes, so the tiles resolve actual art instead of the fallback. */
const card = (id: string, name: string, cost: number, imageHashSm: string): LorcanaCard =>
  ({id, name, fullName: name, cost, type: 'Character', ink: 'Amethyst', imageHashSm} as LorcanaCard);

const LINES = [
  {card: card('2888', 'Omnidroid - V.8', 1, 'c2298563d34f4ac4'), quantity: 4},
  {card: card('3172', 'You Broke My Smolder', 1, 'c2298563d34f4ac4'), quantity: 2},
  {card: card('2887', 'Incrediboy - Buddy Pine', 2, 'c2298563d34f4ac4'), quantity: 4},
  {card: card('2886', 'Morph - Little Imitator', 2, 'c2298563d34f4ac4'), quantity: 4},
];

const meta: Meta<typeof DeckCardGrid> = {
  title: 'Deck/DeckCardGrid',
  component: DeckCardGrid,
  tags: ['autodocs'],
  decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  args: {lines: LINES, onSelectCard: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The deck as its cards. Order is the caller's — the grid never sorts. */
export const Default: Story = {};

/**
 * A playset and a singleton side by side. "1x" is the case that reads oddly if the
 * badge is ever made conditional, so it stays visible at every count.
 */
export const MixedCounts: Story = {
  args: {lines: [{...LINES[0], quantity: 4}, {...LINES[1], quantity: 1}]},
};

/** No handler: a decorative grid, for an export image or a print view. */
export const NotInteractive: Story = {args: {onSelectCard: undefined}};
