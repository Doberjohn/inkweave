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
  accuracySentiment: meanGap == null ? null : -meanGap / 3,
  pairsCovered: scoreVotes * 3,
});

const RULES: RuleStat[] = [
  rule('ramp', 'Ramp', 'playstyle', 557, -0.57),
  rule('shift-targets', 'Shift Targets', 'direct', 214, -0.22),
  rule('singer-songs', 'Singer + Songs', 'direct', 141, 0.14),
  rule('discard', 'Discard', 'playstyle', 103, 0.83),
  rule('location-boost', 'Location Boost', 'playstyle', 9, 2.44),
];

const pair = (
  a: string,
  b: string,
  aName: string,
  bName: string,
  engineScore: number,
  communityScore: number,
  scoreVotes: number,
  rules: string[],
): PairStat => ({
  a,
  b,
  aName,
  bName,
  engineScore,
  communityScore,
  gap: engineScore - communityScore,
  scoreVotes,
  rules,
});

const PAIRS: PairStat[] = [
  pair('crd-loc-1', 'crd-loc-2', 'Cogsworth', 'Beast’s Castle', 9, 3, 4, ['location-boost']),
  pair('crd-ramp-1', 'crd-ramp-2', 'Maui', 'Fishhook', 8, 5, 12, ['ramp']),
  pair('crd-ramp-3', 'crd-ramp-4', 'Pawpsicle', 'Duke of Weselton', 7, 5, 6, ['ramp']),
  pair('crd-disc-1', 'crd-disc-2', 'Mad Hatter', 'The Queen of Hearts', 5, 7, 5, ['discard']),
  pair('crd-shift-1', 'crd-shift-2', 'Elsa - Spirit', 'Elsa - Snow Queen', 8, 7, 3, ['shift-targets']),
  pair('crd-sing-1', 'crd-sing-2', 'Ariel - Singer', 'Part of Your World', 8, 8, 2, ['singer-songs']),
];

const votes: VoteLogRow[] = [
  {
    a: 'crd-ramp-1',
    b: 'crd-ramp-2',
    aName: 'Maui',
    bName: 'Fishhook',
    score: 5,
    accuracy: -1,
    isReal: true,
    wouldPlay: true,
    difficulty: 2,
    whoCarries: null,
    ts: '2026-06-28T14:20:00Z',
    voter: 41,
  },
  {
    a: 'crd-ramp-1',
    b: 'crd-ramp-2',
    aName: 'Maui',
    bName: 'Fishhook',
    score: 6,
    accuracy: 0,
    isReal: true,
    wouldPlay: false,
    difficulty: 3,
    whoCarries: null,
    ts: '2026-06-27T09:05:00Z',
    voter: 12,
  },
  {
    a: 'crd-ramp-1',
    b: 'crd-ramp-2',
    aName: 'Maui',
    bName: 'Fishhook',
    score: 4,
    accuracy: 1,
    isReal: false,
    wouldPlay: null,
    difficulty: null,
    whoCarries: null,
    ts: '2026-06-25T18:44:00Z',
    voter: 88,
  },
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
    dimensionFill: {
      score: 2054,
      accuracy: 1610,
      isReal: 1204,
      wouldPlay: 980,
      difficulty: 742,
    },
  },
  rules: RULES,
  pairs: PAIRS,
};

const VOTE_LOG: VoteLog = {
  generatedAt: '2026-06-30T00:00:00Z',
  votes,
  voterCount: 114,
};

const NO_RAW: VoteAnalytics = {
  ...WITH_DATA,
  hasRawVotes: false,
  global: {
    ...WITH_DATA.global,
    distinctVoters: null,
    weekly: [],
    dimensionFill: null,
  },
};

const EMPTY_LOG: VoteLog = {generatedAt: '2026-06-30T00:00:00Z', votes: [], voterCount: 0};

export const WithData: Story = {args: {analytics: WITH_DATA, voteLog: VOTE_LOG}};
export const NoRawVotes: Story = {args: {analytics: NO_RAW, voteLog: EMPTY_LOG}};
