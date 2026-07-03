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

const vote = (
  voter: number,
  score: number | null,
  accuracy: number | null,
  wouldPlay: boolean | null,
  ts: string,
): VoteLogRow => ({
  a: 'crd_a',
  b: 'crd_b',
  aName: 'Sisu - Divine Water Dragon',
  bName: 'Raya - Leader of Heart',
  score,
  accuracy,
  isReal: true,
  wouldPlay,
  difficulty: null,
  whoCarries: null,
  ts,
  voter,
});

const VOTES: VoteLogRow[] = [
  vote(1, 8, -1, true, '2026-06-28T14:02:00Z'),
  vote(2, 5, 0, false, '2026-06-29T09:41:00Z'),
  vote(3, 3, 1, null, '2026-06-30T22:15:00Z'),
];

export const WithVotes: Story = {
  args: {
    pair: {aName: 'Sisu - Divine Water Dragon', bName: 'Raya - Leader of Heart', engineScore: 8},
    votes: VOTES,
  },
};

export const Empty: Story = {args: {pair: null, votes: []}};
