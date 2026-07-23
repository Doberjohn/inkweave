import type {Meta, StoryObj} from '@storybook/react-vite';
import {RuleCalibrationTable} from './RuleCalibrationTable';
import type {RuleStat} from './voteAnalyticsTypes';

const meta: Meta<typeof RuleCalibrationTable> = {
  title: 'Features/AdminAnalytics/RuleCalibrationTable',
  component: RuleCalibrationTable,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const rule = (
  ruleId: string,
  ruleName: string,
  category: 'direct' | 'playstyle',
  scoreVotes: number,
  meanGap: number | null,
): RuleStat => ({
  ruleId,
  ruleName,
  category,
  scoreVotes,
  pairsVoted: Math.round(scoreVotes / 2),
  meanGap,
  accuracySentiment: meanGap == null ? null : -meanGap / 2,
  pairsCovered: scoreVotes * 3,
});

const RULES: RuleStat[] = [
  rule('ramp', 'Ramp', 'playstyle', 557, -0.57),
  rule('shift-targets', 'Shift Targets', 'direct', 214, -0.31),
  rule('singer-songs', 'Singer + Songs', 'direct', 143, 0.18),
  rule('location-boost', 'Location Boost', 'playstyle', 9, 2.44),
  rule('discard', 'Discard', 'playstyle', 88, 0.62),
  rule('dwarfs', 'Seven Dwarfs', 'playstyle', 0, null),
];

const noop = () => {};

export const Default: Story = {args: {rules: RULES, selectedRuleId: null, onSelectRule: noop}};
export const RuleSelected: Story = {args: {rules: RULES, selectedRuleId: 'ramp', onSelectRule: noop}};
export const LowSampleSelected: Story = {args: {rules: RULES, selectedRuleId: 'location-boost', onSelectRule: noop}};
