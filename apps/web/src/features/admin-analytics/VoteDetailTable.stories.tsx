import type {Meta, StoryObj} from '@storybook/react-vite';
import {VoteDetailTable} from './VoteDetailTable';
import type {VoteLogRow} from './voteLogTypes';

const meta: Meta<typeof VoteDetailTable> = {
  title: 'Features/AdminAnalytics/VoteDetailTable',
  component: VoteDetailTable,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const DEFAULT_VOTE: VoteLogRow = {
  a: 'crd_a',
  b: 'crd_b',
  aName: 'Sisu - Divine Water Dragon',
  bName: 'Raya - Leader of Heart',
  score: null,
  accuracy: null,
  isReal: true,
  wouldPlay: null,
  difficulty: null,
  whoCarries: null,
  ts: '',
  voter: 1,
};

/** Build a VoteLogRow fixture over the shared default pair. */
const vote = (v: Partial<VoteLogRow>): VoteLogRow => ({...DEFAULT_VOTE, ...v});

const VOTES: VoteLogRow[] = [
  vote({voter: 1, score: 8, accuracy: -1, wouldPlay: true, ts: '2026-06-28T14:02:00Z'}),
  vote({voter: 2, score: 5, accuracy: 0, wouldPlay: false, ts: '2026-06-29T09:41:00Z'}),
  vote({voter: 3, score: 3, accuracy: 1, wouldPlay: null, ts: '2026-06-30T22:15:00Z'}),
];

export const WithVotes: Story = {
  args: {
    pair: {aName: 'Sisu - Divine Water Dragon', bName: 'Raya - Leader of Heart', engineScore: 8},
    votes: VOTES,
  },
};

export const Empty: Story = {args: {pair: null, votes: []}};
