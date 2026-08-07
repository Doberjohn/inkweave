import type {Meta, StoryObj} from '@storybook/react-vite';
import {DeckListSkeleton} from './DeckListSkeleton';

/**
 * The `/decks` grid before its data arrives.
 *
 * Worth viewing beside `Deck/DeckSummaryCard`: the two must agree on column width,
 * gap and aspect, and they do so by SHARING `deckGrid.ts` and the frame's own ratio
 * rather than restating them. Measured against the real page on both a cold load and
 * a return from a deck view, the first tile moves 0px.
 */
const meta: Meta<typeof DeckListSkeleton> = {
  title: 'Deck/DeckListSkeleton',
  component: DeckListSkeleton,
  tags: ['autodocs'],
  args: {ariaLabel: 'Loading community decks'},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The community tab: a screenful, because the shared feed is usually long. */
export const CommunityList: Story = {};

/**
 * Your own tab, which is usually short. Eight placeholders for two decks promises
 * more than arrives, which is its own kind of jolt.
 */
export const YourList: Story = {args: {count: 4, ariaLabel: 'Loading your decks'}};
