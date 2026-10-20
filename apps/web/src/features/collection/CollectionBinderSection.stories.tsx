import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CollectionBinderSection} from './CollectionBinderSection';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import type {CollectionEntries} from './collectionParser';
import {COLORS} from '../../shared/constants';

/**
 * Collection mode's content: the set panel and one set's binder, plus the
 * loading and failure states that must never fall through to an empty binder.
 * The section draws the set panel only where the page does not dock it: as its
 * rail from 768 to 1023px of viewport, as a strip on phones. At 1024px and up
 * (`useSidePanelDocked`) the page renders the panel itself, so these stories show
 * the binder alone; the set panel's own stories cover its numbers. The fixture
 * cards are Set 9.
 */
const entries: CollectionEntries = Object.fromEntries(
  BINDER_CARDS.map((card) => {
    const n = Number(card.id);
    return [card.id, {normal: n % 3 === 0 ? 2 : n % 2 === 0 ? 1 : 0, foil: n % 5 === 0 ? 1 : 0}];
  }),
);

/** The cards a cost filter of 3 or less lets through. */
const CHEAP = BINDER_CARDS.filter((c) => c.cost <= 3);

const meta: Meta<typeof CollectionBinderSection> = {
  title: 'Collection/CollectionBinderSection',
  component: CollectionBinderSection,
  decorators: [
    (Story) => (
      <MemoryRouter>
        <div style={{height: 800, background: COLORS.background}}>
          <Story />
        </div>
      </MemoryRouter>
    ),
  ],
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    cards: BINDER_CARDS,
    matchedIds: new Set(BINDER_CARDS.map((c) => c.id)),
    counted: BINDER_CARDS,
    filtered: false,
    sortOrder: 'newest',
    entries,
    isLoading: false,
    error: null,
    onRetry: fn(),
    setCode: '9',
    sets: ['13', '9', '1'],
    setsLoading: false,
    onSetChange: fn(),
    show: 'all',
    onShowChange: fn(),
    axis: 'complete',
    onAxisChange: fn(),
    onCardSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A set with a partly-owned collection, in collector order (the default sort). */
export const Default: Story = {};

/** Sorted by cost instead: the pockets fill cheapest first, and ownership still shows on each card. */
export const SortedByCost: Story = {
  args: {sortOrder: 'cost-asc'},
};

/**
 * Filtered to cost 3 or less: only the cards that pass, packed into the pockets in order,
 * and the set panel's numbers count only them.
 */
export const Filtered: Story = {
  args: {matchedIds: new Set(CHEAP.map((c) => c.id)), counted: CHEAP, filtered: true},
};

/** Nothing in the set passes the filters: said in words, not drawn as an empty binder. */
export const NoMatches: Story = {
  args: {matchedIds: new Set(), counted: [], filtered: true},
};

/** Chunks in flight: the same chrome with shimmer in the pockets, so nothing shifts on arrival. */
export const Loading: Story = {
  args: {isLoading: true},
};

/**
 * The fetch failed. A message and a retry rather than an empty binder, because a
 * binder of blank slots is indistinguishable from "you own none of this set".
 */
export const LoadFailed: Story = {
  args: {error: 'Could not load the collection (set 4: HTTP 502).'},
};
