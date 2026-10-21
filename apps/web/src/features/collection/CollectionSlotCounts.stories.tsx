import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CollectionSlotCounts} from './CollectionSlotCounts';
import type {Finish} from './collectionParser';
import {COLORS} from '../../shared/constants';

/** A pocket on a phone's single page, where the counts never open. */
const PHONE_SLOT = {width: 76, height: 105};
/** A pocket at the size a 1920px screen gives the binder. Only a desktop spread opens its stripe. */
const DESKTOP_SLOT = {width: 144, height: 200};
/** A pocket at the size a 1440px screen gives the binder, where the stripe scales down with the card. */
const NARROW_SLOT = {width: 84, height: 117};
/** A card printed in both finishes, as most are (`finishesOf`). */
const BOTH: readonly Finish[] = ['normal', 'foil'];

/**
 * A binder slot's counts, a stripe across the card's foot: at rest, normal on the dark ground
 * and foil on brushed gold, only the finishes held; pointed at by a mouse, open from the
 * middle to the card's edges (#826). The frame stands in for the pocket, a phone's unless a
 * story names another `slot`.
 */
const meta: Meta<typeof CollectionSlotCounts> = {
  title: 'Collection/CollectionSlotCounts',
  component: CollectionSlotCounts,
  decorators: [
    (Story, {parameters}) => (
      <div
        style={{
          position: 'relative',
          ...(parameters.slot ?? PHONE_SLOT),
          background: COLORS.surfaceAlt,
          margin: 16,
        }}>
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

/** Double-digit counts, the widest a real export produces (max observed 10). */
export const DoubleDigits: Story = {args: {counts: {normal: 10, foil: 10}}};

/** Unowned: nothing renders; the card's greyscale says it instead. */
export const Unowned: Story = {args: {counts: {normal: 0, foil: 0}}};

/** Pointed at: each finish opens into − count +, the unheld foil at 0 with its − off. */
export const PointedAt: Story = {
  parameters: {slot: DESKTOP_SLOT},
  args: {counts: {normal: 2, foil: 0}, editor: {finishes: BOTH, onChange: fn()}},
};

/** Pointed at in a 1440px screen's pocket: the same stripe, scaled down with the card. */
export const PointedAtNarrow: Story = {
  parameters: {slot: NARROW_SLOT},
  args: {counts: {normal: 2, foil: 1}, editor: {finishes: BOTH, onChange: fn()}},
};

/** Pointed at, a card you hold none of: both finishes open at 0, a first copy one click away. */
export const PointedAtUnowned: Story = {
  parameters: {slot: DESKTOP_SLOT},
  args: {counts: {normal: 0, foil: 0}, editor: {finishes: BOTH, onChange: fn()}},
};

/** Pointed at, a card printed only in foil (Enchanted, Epic, Iconic, the alt foils): only Foil opens. */
export const PointedAtFoilOnly: Story = {
  parameters: {slot: DESKTOP_SLOT},
  args: {counts: {normal: 0, foil: 1}, editor: {finishes: ['foil'], onChange: fn()}},
};

/** Pointed at, a promo printed only in normal, as 1/C3 is (#880): only Normal opens. */
export const PointedAtNormalOnly: Story = {
  parameters: {slot: DESKTOP_SLOT},
  args: {counts: {normal: 1, foil: 0}, editor: {finishes: ['normal'], onChange: fn()}},
};
