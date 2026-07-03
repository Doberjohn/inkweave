import type {Meta, StoryObj} from '@storybook/react-vite';
import {CalibrationView} from './CalibrationView';
import type {PairStat, RuleStat, VoteAnalytics} from './voteAnalyticsTypes';
import type {VoteLog, VoteLogRow} from './voteLogTypes';

const meta: Meta<typeof CalibrationView> = {
  title: 'Features/AdminAnalytics/CalibrationView',
  component: CalibrationView,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

type RuleSeed = Pick<RuleStat, 'ruleId' | 'ruleName' | 'category' | 'scoreVotes' | 'meanGap'>;
/** Build a RuleStat fixture, deriving the secondary counts from scoreVotes/meanGap. */
const rule = (r: RuleSeed): RuleStat => ({
  ...r,
  pairsVoted: Math.round(r.scoreVotes / 2),
  accuracySentiment: r.meanGap == null ? null : -r.meanGap / 3,
  pairsCovered: r.scoreVotes * 3,
});

const RULES: RuleStat[] = [
  rule({ruleId: 'ramp', ruleName: 'Ramp', category: 'playstyle', scoreVotes: 557, meanGap: -0.57}),
  rule({ruleId: 'shift-targets', ruleName: 'Shift Targets', category: 'direct', scoreVotes: 214, meanGap: -0.22}),
  rule({ruleId: 'singer-songs', ruleName: 'Singer + Songs', category: 'direct', scoreVotes: 141, meanGap: 0.14}),
  rule({ruleId: 'discard', ruleName: 'Discard', category: 'playstyle', scoreVotes: 103, meanGap: 0.83}),
  rule({ruleId: 'location-boost', ruleName: 'Location Boost', category: 'playstyle', scoreVotes: 9, meanGap: 2.44}),
];

type PairSeed = Pick<
  PairStat,
  'a' | 'b' | 'aName' | 'bName' | 'engineScore' | 'communityScore' | 'scoreVotes' | 'rules'
>;
/** Build a PairStat fixture; gap = communityScore - engineScore (the real convention). */
const pair = (p: PairSeed): PairStat => ({...p, gap: p.communityScore - p.engineScore});

const PAIRS: PairStat[] = [
  pair({a: 'crd-loc-1', b: 'crd-loc-2', aName: 'Cogsworth', bName: 'Beast’s Castle', engineScore: 9, communityScore: 3, scoreVotes: 4, rules: ['location-boost']}),
  pair({a: 'crd-ramp-1', b: 'crd-ramp-2', aName: 'Maui', bName: 'Fishhook', engineScore: 8, communityScore: 5, scoreVotes: 12, rules: ['ramp']}),
  pair({a: 'crd-ramp-3', b: 'crd-ramp-4', aName: 'Pawpsicle', bName: 'Duke of Weselton', engineScore: 7, communityScore: 5, scoreVotes: 6, rules: ['ramp']}),
  pair({a: 'crd-disc-1', b: 'crd-disc-2', aName: 'Mad Hatter', bName: 'The Queen of Hearts', engineScore: 5, communityScore: 7, scoreVotes: 5, rules: ['discard']}),
  pair({a: 'crd-shift-1', b: 'crd-shift-2', aName: 'Elsa - Spirit', bName: 'Elsa - Snow Queen', engineScore: 8, communityScore: 7, scoreVotes: 3, rules: ['shift-targets']}),
  pair({a: 'crd-sing-1', b: 'crd-sing-2', aName: 'Ariel - Singer', bName: 'Part of Your World', engineScore: 8, communityScore: 8, scoreVotes: 2, rules: ['singer-songs']}),
];

const votes: VoteLogRow[] = [
  {a: 'crd-ramp-1', b: 'crd-ramp-2', aName: 'Maui', bName: 'Fishhook', score: 5, accuracy: -1, isReal: true, wouldPlay: true, difficulty: 2, whoCarries: null, ts: '2026-06-28T14:20:00Z', voter: 41},
  {a: 'crd-ramp-1', b: 'crd-ramp-2', aName: 'Maui', bName: 'Fishhook', score: 6, accuracy: 0, isReal: true, wouldPlay: false, difficulty: 3, whoCarries: null, ts: '2026-06-27T09:05:00Z', voter: 12},
  {a: 'crd-ramp-1', b: 'crd-ramp-2', aName: 'Maui', bName: 'Fishhook', score: 4, accuracy: 1, isReal: false, wouldPlay: null, difficulty: null, whoCarries: null, ts: '2026-06-25T18:44:00Z', voter: 88},
];

const WITH_DATA: VoteAnalytics = {
  generatedAt: '2026-06-30T00:00:00Z',
  hasRawVotes: true,
  global: {
    totalVotes: 2054,
    distinctPairs: 1928,
    distinctVoters: 114,
    meanGap: -0.3,
    accuracySentiment: 0.03,
    engineSilentPairs: 196,
    weekly: [
      {week: '2026-W20', votes: 180, meanGap: -0.41},
      {week: '2026-W21', votes: 260, meanGap: -0.35},
      {week: '2026-W22', votes: 315, meanGap: -0.28},
      {week: '2026-W23', votes: 402, meanGap: -0.31},
      {week: '2026-W24', votes: 388, meanGap: -0.22},
      {week: '2026-W25', votes: 509, meanGap: -0.3},
    ],
    dimensionFill: {score: 2054, accuracy: 1610, isReal: 1204, wouldPlay: 980, difficulty: 742},
  },
  rules: RULES,
  pairs: PAIRS,
};

const VOTE_LOG: VoteLog = {generatedAt: '2026-06-30T00:00:00Z', votes, voterCount: 114};

const NO_RAW: VoteAnalytics = {
  ...WITH_DATA,
  hasRawVotes: false,
  global: {...WITH_DATA.global, distinctVoters: null, weekly: [], dimensionFill: null},
};

const EMPTY_LOG: VoteLog = {generatedAt: '2026-06-30T00:00:00Z', votes: [], voterCount: 0};

export const WithData: Story = {args: {analytics: WITH_DATA, voteLog: VOTE_LOG}};
export const NoRawVotes: Story = {args: {analytics: NO_RAW, voteLog: EMPTY_LOG}};
