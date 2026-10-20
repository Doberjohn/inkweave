import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {VoteGroupTabs} from './VoteGroupTabs';
import {COLORS, RADIUS, TIER_COLORS} from '../../../shared/constants';

// The in-depth vote form's three groups, in its colours.
const GROUPS = [
  {key: 'assessment', label: 'Assessment', accent: TIER_COLORS.moderate.color},
  {key: 'rating', label: 'Rating', accent: TIER_COLORS.perfect.color},
  {key: 'practical', label: 'Practical', accent: TIER_COLORS.strong.color},
];

const meta = {
  title: 'Voting/VoteGroupTabs',
  component: VoteGroupTabs,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 512, padding: 24, background: COLORS.surface, borderRadius: RADIUS.card}}>
        <Story />
      </div>
    ),
  ],
  args: {
    groups: GROUPS,
    activeTab: 'assessment',
    onTabChange: fn(),
    answeredByGroup: {assessment: 1, rating: 2, practical: 0},
  },
} satisfies Meta<typeof VoteGroupTabs>;

export default meta;
type Story = StoryObj<typeof meta>;

/** The first group open, one of its two questions answered; Rating's are both done. */
export const Default: Story = {};

/** The last group open. */
export const PracticalOpen: Story = {
  args: {activeTab: 'practical'},
};
