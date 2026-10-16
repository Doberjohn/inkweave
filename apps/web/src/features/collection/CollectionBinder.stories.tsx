import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {CollectionBinder} from './CollectionBinder';
import type {CollectionEntry} from './collectionParser';
import {BINDER_CARDS} from '../cards/components/binderStoryCards';
import {COLORS} from '../../shared/constants';

/**
 * The collection binder: the cards it is given, pocket by pocket, in their order. The
 * page gives it the set's cards that pass its filters, in its sort (owner, 2026-10-12),
 * so unfiltered it is the whole set in collector order.
 *
 * Two states share the pockets and must stay distinguishable:
 *   owned     full colour, with read-only counts per finish
 *   unowned   desaturated, no counts: the card exists, you do not have it
 */

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
    countsFor: counts,
    onSelect: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** A partly-collected set: owned, doubled, foiled and missing, side by side. */
export const Default: Story = {};

/** Everything owned: no greyed cards, so the page reads as complete. */
export const FullyOwned: Story = {
  args: {countsFor: () => ({normal: 1, foil: 0})},
};

/** Nothing owned. The set is still legible as a set, which is the point. */
export const NothingOwned: Story = {
  args: {countsFor: () => ({normal: 0, foil: 0})},
};

/**
 * Where Browse docks its panels (owner, 2026-10-12): no arrows beside the spread; the
 * spread map underneath turns the pages, one cell per pocket, gold where you hold the card.
 */
export const WithMap: Story = {
  args: {pager: 'map'},
};

/** Phone width: one page per view, paged by twelve. */
export const SinglePage: Story = {
  args: {single: true},
  globals: {viewport: {value: 'mobile1'}},
};
