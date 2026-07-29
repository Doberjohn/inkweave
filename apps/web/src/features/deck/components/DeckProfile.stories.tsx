import type {Meta, StoryObj} from '@storybook/react-vite';
import {COLORS} from '../../../shared/constants';
import type {DeckStats} from '../types';
import {DeckProfile} from './DeckProfile';

const stats = (over: Partial<DeckStats> = {}): DeckStats => ({
  totalCards: 43,
  uniqueCards: 12,
  inkDistribution: {Amber: 24, Ruby: 19},
  costCurve: {1: 4, 2: 12, 3: 8, 4: 9, 5: 6, 6: 2, 7: 2},
  costCurveByInk: {},
  typeDistribution: {Character: 31, Action: 12},
  inkCount: 2,
  inkableCount: 31,
  isLegal: false,
  legalityErrors: [],
  ...over,
});

const meta: Meta<typeof DeckProfile> = {
  title: 'Deck/DeckProfile',
  component: DeckProfile,
  decorators: [
    (Story) => (
      <div style={{background: COLORS.surface, width: 460}}>
        <Story />
      </div>
    ),
  ],
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const TwoInks: Story = {args: {stats: stats()}};

// A single-ink deck: one bar at full width.
export const SingleInk: Story = {
  args: {stats: stats({inkDistribution: {Amber: 43}, inkCount: 1})},
};

// Nothing added yet: the tab invites rather than showing empty bars.
export const EmptyDeck: Story = {
  args: {
    stats: stats({totalCards: 0, uniqueCards: 0, inkDistribution: {}, typeDistribution: {}, inkableCount: 0, inkCount: 0}),
  },
};
