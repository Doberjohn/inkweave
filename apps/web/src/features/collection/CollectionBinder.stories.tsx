import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CollectionBinder} from './CollectionBinder';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import {COLORS} from '../../shared/constants';

/**
 * The collection binder: FIXED SLOTS, the opposite of `BrowseBinder`'s
 * compacting fill. A card's position never moves, because the question is "what
 * am I missing?" and a moving card cannot answer it.
 *
 * Three states share the grid and must stay distinguishable:
 *   owned         full colour
 *   unowned       desaturated  — the card exists, you do not have it
 *   filtered out  faded        — the card is there, it is not what you asked for
 * Collapsing the last two would make a filter look like a gap in the collection.
 */
const ALL_IDS = new Set(BINDER_CARDS.map((c) => c.id));

/** Own every third card twice, every other one once, the rest not at all. */
const owned = (cardId: string): number => {
  const n = Number(cardId);
  if (n % 3 === 0) return 2;
  if (n % 2 === 0) return 1;
  return 0;
};

const meta: Meta<typeof CollectionBinder> = {
  title: 'Collection/CollectionBinder',
  component: CollectionBinder,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 760, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    cards: BINDER_CARDS,
    matchedIds: ALL_IDS,
    ownedCount: owned,
    finish: 'normal',
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A partly-collected set: owned, doubled (gold count badge) and unowned. */
export const Default: Story = {};

/** Everything owned — no greyed cards, so the page reads as complete. */
export const FullyOwned: Story = {
  args: {ownedCount: () => 1},
};

/** Nothing owned. The set is still legible as a set, which is the point. */
export const NothingOwned: Story = {
  args: {ownedCount: () => 0},
};

/**
 * Filtered. Non-matching cards fade but KEEP THEIR SLOT, and the label counts
 * matches within this set rather than across the merged pool — the bug that
 * once read "3176 match" on a 216-card binder.
 */
export const Filtered: Story = {
  args: {
    matchedIds: new Set(BINDER_CARDS.filter((c) => c.cost <= 3).map((c) => c.id)),
  },
};

/**
 * Foil. A different ownership answer entirely, not a restyle — measured on a
 * real collection, Set 1 was 204 owned in normal and 62 in foil.
 */
export const FoilView: Story = {
  args: {
    finish: 'foil',
    ownedCount: (cardId: string) => (Number(cardId) % 5 === 0 ? 1 : 0),
  },
};
