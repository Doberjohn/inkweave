import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import {TypeSplitPips} from './TypeSplitPips';

const meta: Meta<typeof TypeSplitPips> = {
  title: 'Deck/TypeSplitPips',
  component: TypeSplitPips,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, width: 300, padding: 8}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// A typical midrange deck: mostly characters, a handful of actions, a couple items.
export const Typical: Story = {
  args: {typeDistribution: {Character: 34, Action: 18, Item: 6, Location: 2}},
};

// A characters-and-actions deck: the absent Item/Location pips are omitted, not zero-filled.
export const SomeTypesAbsent: Story = {
  args: {typeDistribution: {Character: 42, Action: 18}},
};

// An empty deck: the pips self-hide so a fresh build stays clean.
export const Empty: Story = {args: {typeDistribution: {}}};
