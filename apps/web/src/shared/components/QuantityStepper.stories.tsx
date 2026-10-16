import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {COLORS} from '../constants';
import {QuantityStepper} from './QuantityStepper';

const meta: Meta<typeof QuantityStepper> = {
  title: 'Shared/QuantityStepper',
  component: QuantityStepper,
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, padding: 40}}>
        <Story />
      </div>
    ),
  ],
  args: {onIncrement: fn(), onDecrement: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {value: 2, label: 'Pocahontas'}};

export const Small: Story = {args: {value: 2, size: 'sm', label: 'Pocahontas'}};

/**
 * The binder size. It exists because the collection binder puts TWO steppers side
 * by side inside one card slot, and that slot is 114px wide at 1280x720 — measured
 * in the app, and height-driven, so it shrinks on a short window rather than
 * growing on a wide one. Two of these are 108px including the gap.
 */
export const ExtraSmall: Story = {args: {value: 2, size: 'xs', label: 'Pocahontas'}};

/**
 * The foil tone: brushed gold with a light band, replacing the flat ground so two
 * pills side by side are told apart by surface rather than by a letter. The gold
 * is semi-transparent over that ground, which is what keeps the count legible —
 * flat `COLORS.primary` behind white bold text is 3.0:1 and fails.
 */
export const Foil: Story = {args: {value: 2, size: 'xs', tone: 'foil', label: 'foil Pocahontas'}};

/**
 * The same pill with the light band travelling. Opt-in per surface: the binder
 * sweeps the hovered stepper and leaves its resting badges parked, because two
 * dozen simultaneous sweeps on one spread is a disco rather than a highlight.
 * `prefers-reduced-motion` parks this one too.
 */
export const FoilShimmer: Story = {
  args: {value: 2, size: 'xs', tone: 'foil', shimmer: true, label: 'foil Pocahontas'},
};

export const Collapsed: Story = {args: {value: 2, collapsed: true, label: 'Pocahontas'}};

export const AtMax: Story = {args: {value: 4, incrementDisabled: true, disabledReason: 'Maximum 4 copies', label: 'Pocahontas'}};
