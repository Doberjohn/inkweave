import type {Meta, StoryObj} from '@storybook/react-vite';
import {ActivityView} from './ActivityView';
import type {VoteLog, VoteLogRow} from './voteLogTypes';

const vote = (over: Partial<VoteLogRow>): VoteLogRow => ({
  a: 'p1',
  b: 'p2',
  aName: 'Elsa',
  bName: 'Anna',
  score: 7,
  accuracy: 1,
  isReal: true,
  wouldPlay: true,
  difficulty: 2,
  whoCarries: 'A',
  ts: '2026-07-02T14:32:05Z',
  voter: 1,
  ...over,
});

const votes: VoteLogRow[] = [
  // Day 1: 2026-07-02
  vote({aName: 'Elsa - Spirit of Winter', bName: 'Anna - Heir to Arendelle', score: 9, whoCarries: 'A', ts: '2026-07-02T09:12:44Z', voter: 1}),
  vote({aName: 'Maui - Hero to All', bName: 'Moana - Of Motunui', score: 6, whoCarries: 'B', ts: '2026-07-02T11:05:19Z', voter: 3}),
  vote({aName: 'Scar - Shameless Firebrand', bName: 'Simba - Returned King', score: 3, whoCarries: null, ts: '2026-07-02T13:47:02Z', voter: 5}),
  vote({aName: 'Belle - Strange but Special', bName: 'Beast - Hardheaded', score: 8, whoCarries: 'A', ts: '2026-07-02T18:59:11Z', voter: 6}),
  // Day 2: 2026-07-01
  vote({aName: 'Gaston - Arrogant Hunter', bName: 'LeFou - Instigator', score: 4, whoCarries: 'B', ts: '2026-07-01T10:22:01Z', voter: 2}),
  vote({aName: 'Mickey Mouse - Brave Little Tailor', bName: 'Goofy - Musketeer', score: 7, whoCarries: 'A', ts: '2026-07-01T14:40:33Z', voter: 4}),
  vote({aName: 'Stitch - Rock Star', bName: 'Lilo - Making a Wish', score: 5, whoCarries: null, ts: '2026-07-01T17:08:55Z', voter: 1}),
  // Day 3: 2026-06-30
  vote({aName: 'Jafar - Wickedly Powerful', bName: 'Iago - Loud-Mouthed Parrot', score: 6, whoCarries: 'A', ts: '2026-06-30T08:15:12Z', voter: 3}),
  vote({aName: 'Ariel - Spectacular Singer', bName: 'Ursula - Power Hungry', score: 8, whoCarries: 'B', ts: '2026-06-30T12:31:47Z', voter: 5}),
];

const voteLog: VoteLog = {
  generatedAt: '2026-07-02T20:00:00Z',
  votes,
  voterCount: 6,
};

const meta: Meta<typeof ActivityView> = {
  title: 'Features/AdminAnalytics/ActivityView',
  component: ActivityView,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {args: {voteLog}};

export const Empty: Story = {
  args: {voteLog: {generatedAt: '2026-07-02T20:00:00Z', votes: [], voterCount: 0}},
};
