import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CollectionSlotSteppers} from './CollectionSlotSteppers';
import {COLORS, RADIUS} from '../../shared/constants';

/**
 * Per-finish quantity editing on one binder slot.
 *
 * The component is absolutely positioned over a card image, so the decorator
 * supplies a slot-sized box at the NARROWEST slot the app produces: 114x158,
 * measured on /browse?view=binder at 1280x720. Sizing the fixture generously is
 * exactly the mistake that shipped a layout which did not fit — the slot is
 * height-driven, so it shrinks on a short window instead of growing on a wide
 * monitor, and 114px is the width the two steppers have to share.
 *
 * NORMAL IS LEFT AND PLAIN, FOIL IS RIGHT AND IRIDESCENT. There is no `N`/`F`
 * letter: it was tried, and at this size it doubled the glyph count on every
 * tile to label something `FOIL_SHEEN` says at a glance. The finish is still in
 * each control's aria-label, so nothing is lost to a screen reader.
 *
 * THE QUESTION THESE STORIES EXIST TO ANSWER: how does someone add the FIRST
 * copy of a card they do not own? Compare `NothingOwned` against
 * `NothingOwnedPlusVariant` — the same slot, two affordances.
 */
const meta: Meta<typeof CollectionSlotSteppers> = {
  title: 'Collection/CollectionSlotSteppers',
  component: CollectionSlotSteppers,
  decorators: [
    (Story) => (
      <div
        style={{
          position: 'relative',
          width: 114,
          height: 158,
          background: COLORS.surfaceRaised,
          borderRadius: `${RADIUS.sm}px`,
        }}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
  args: {
    counts: {normal: 2, foil: 1},
    variant: 'zeros',
    hovered: false,
    label: 'Angel - Experiment 624',
    onChange: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Two copies and a foil. Both numbers at rest — the finish toggle's replacement. */
export const Owned: Story = {};

/**
 * Owned in one finish only, which is the common case: a real collection had
 * 204 of Set 1 in normal and 62 in foil. The quiet `0` says "none of these"
 * without competing with the count that is an actual holding.
 */
export const NormalOnly: Story = {
  args: {counts: {normal: 3, foil: 0}},
};

/** Unowned, `zeros`: two quiet zeros. One visual language on every slot. */
export const NothingOwned: Story = {
  args: {counts: {normal: 0, foil: 0}},
};

/** Unowned, `plus`: one glyph instead. Quieter, at the cost of a second language. */
export const NothingOwnedPlusVariant: Story = {
  args: {counts: {normal: 0, foil: 0}, variant: 'plus'},
};

/**
 * Hovered — the steppers replace the resting counts in place.
 *
 * Set by prop, not by a play function: hover belongs to the SLOT, because this
 * component only covers the bottom strip of a tile and owning hover here made
 * the steppers reachable only by landing the pointer exactly on the badges.
 */
export const Hovered: Story = {
  args: {hovered: true},
};

/** Hovered on a card owned in neither finish — the first-copy case, `zeros`. */
export const HoveredNothingOwned: Story = {
  args: {hovered: true, counts: {normal: 0, foil: 0}},
};
