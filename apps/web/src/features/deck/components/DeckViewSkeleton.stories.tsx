import type {Meta, StoryObj} from '@storybook/react-vite';
import {DeckViewSkeleton} from './DeckViewSkeleton';

/**
 * The deck view's shape before its data arrives.
 *
 * It is worth looking at beside `Deck/DeckCardGrid`: the two must agree on column
 * width and gap, and they do so by SHARING the constants rather than restating them.
 * A skeleton that drifts is worse than none — it promises a layout and then delivers
 * a different one. Measured against the real page, the first card moves 0px.
 */
const meta: Meta<typeof DeckViewSkeleton> = {
  title: 'Deck/DeckViewSkeleton',
  component: DeckViewSkeleton,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
