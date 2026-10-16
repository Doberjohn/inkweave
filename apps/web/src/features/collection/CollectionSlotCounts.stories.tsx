import type {Meta, StoryObj} from '@storybook/react-vite';
import {CollectionSlotCounts} from './CollectionSlotCounts';
import {COLORS} from '../../shared/constants';

/**
 * A binder slot's read-only counts: normal on the dark ground, foil on brushed
 * gold, only the finishes held. The frame stands in for a card slot at the
 * narrowest size the binder produces (76px wide, a phone's single page).
 */
const meta: Meta<typeof CollectionSlotCounts> = {
  title: 'Collection/CollectionSlotCounts',
  component: CollectionSlotCounts,
  decorators: [
    (Story) => (
      <div style={{position: 'relative', width: 76, height: 105, background: COLORS.surfaceAlt, margin: 16}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {counts: {normal: 2, foil: 1}},
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Both finishes held. */
export const Both: Story = {};

/** Normal copies only. */
export const NormalOnly: Story = {args: {counts: {normal: 3, foil: 0}}};

/** Foil only: still owned, so the card is not greyed. */
export const FoilOnly: Story = {args: {counts: {normal: 0, foil: 1}}};

/** Double-digit counts, the widest pills a real export produces (max observed 10). */
export const DoubleDigits: Story = {args: {counts: {normal: 10, foil: 10}}};

/** Unowned: nothing renders; the card's greyscale says it instead. */
export const Unowned: Story = {args: {counts: {normal: 0, foil: 0}}};
