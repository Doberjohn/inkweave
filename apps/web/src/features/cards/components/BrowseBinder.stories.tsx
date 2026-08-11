import type {Meta, StoryObj} from '@storybook/react-vite';
import {MemoryRouter} from 'react-router-dom';
import {fn} from 'storybook/test';
import {BrowseBinder} from './BrowseBinder';
import {BINDER_CARDS, ONE_SPREAD, PARTIAL_SPREAD} from './binderStoryCards';
import {COLORS} from '../../../shared/constants';

/**
 * Browse's binder: COMPACTING. Results fill spreads in order, so a filter that
 * matches seven cards gives one part-full spread, never nine with gaps. Paging
 * is a slice over the array the page already filtered and sorted.
 *
 * The decorator's fixed height is fixture, not styling — see `BinderSpread`.
 */
const meta: Meta<typeof BrowseBinder> = {
  title: 'Cards/BrowseBinder',
  component: BrowseBinder,
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
  args: {cards: BINDER_CARDS, onCardSelect: fn()},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** 26 cards: one full spread plus a two-card tail, so Next is live. */
export const Default: Story = {};

/** Exactly 24 — one spread, both pager directions dead. */
export const ExactlyOneSpread: Story = {
  args: {cards: ONE_SPREAD},
};

/**
 * A narrow filter. The seven matches compact onto one spread and the pager
 * reports the true total; the empty pockets are the shape of the page, not gaps
 * in the results.
 */
export const NarrowFilter: Story = {
  args: {cards: PARTIAL_SPREAD},
};

/**
 * No matches at all. Still one spread, because an empty binder is a binder you
 * are looking at — swapping in a bare "no results" message would drop the
 * reader out of the object they are holding.
 */
export const NoMatches: Story = {
  args: {cards: []},
};
