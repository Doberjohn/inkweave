import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CollectionBinder} from './CollectionBinder';
import type {CollectionEntry} from './collectionParser';
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
 *
 * Hover a slot to raise its two quantity steppers. Both finishes are visible at
 * rest, which is what let the finish toggle go: a mode that answered "how many
 * foils?" is unnecessary once the number is already on the tile.
 */
const ALL_IDS = new Set(BINDER_CARDS.map((c) => c.id));

/** Every third card doubled, every other one single, some of them foiled too. */
const counts = (cardId: string): CollectionEntry => {
  const n = Number(cardId);
  const normal = n % 3 === 0 ? 2 : n % 2 === 0 ? 1 : 0;
  return {normal, foil: n % 5 === 0 ? 1 : 0};
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
    countsFor: counts,
    onChangeCount: fn(),
    variant: 'zeros',
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A partly-collected set: owned, doubled, foiled and missing, side by side. */
export const Default: Story = {};

/** Everything owned — no greyed cards, so the page reads as complete. */
export const FullyOwned: Story = {
  args: {countsFor: () => ({normal: 1, foil: 0})},
};

/**
 * Nothing owned. The set is still legible as a set, which is the point — and in
 * the `zeros` variant it is also the worst case for the affordance: 48 zeros.
 */
export const NothingOwned: Story = {
  args: {countsFor: () => ({normal: 0, foil: 0})},
};

/**
 * The `plus` variant of that same empty page: one glyph per slot instead of two
 * zeros. Quieter at rest, at the cost of a second visual language — the trade
 * the `?steppers=` spike exists to settle.
 */
export const NothingOwnedPlusVariant: Story = {
  args: {countsFor: () => ({normal: 0, foil: 0}), variant: 'plus'},
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
