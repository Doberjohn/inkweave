import type {Meta, StoryObj} from '@storybook/react-vite';
import {DayGroup} from './DayGroup';
import type {VoteLogRow} from './voteLogTypes';

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
  vote({aName: 'Elsa - Spirit of Winter', bName: 'Anna - Heir to Arendelle', score: 9, whoCarries: 'A', ts: '2026-07-02T09:12:44Z', voter: 1}),
  vote({aName: 'Maui - Hero to All', bName: 'Moana - Of Motunui', score: 6, whoCarries: 'B', ts: '2026-07-02T11:05:19Z', voter: 3}),
  vote({aName: 'Scar - Shameless Firebrand', bName: 'Simba - Returned King', score: 3, whoCarries: null, ts: '2026-07-02T13:47:02Z', voter: 5}),
  vote({aName: 'Belle - Strange but Special', bName: 'Beast - Hardheaded', score: 8, whoCarries: 'A', ts: '2026-07-02T15:20:38Z', voter: 7}),
  vote({aName: 'Gaston - Arrogant Hunter', bName: 'LeFou - Instigator', score: 4, whoCarries: 'B', ts: '2026-07-02T18:59:11Z', voter: 9}),
];

// count + voters match the votes array (in the app, DayGroup gets a day's full
// vote list from groupVotesByDay, so count === votes.length and voters is the
// distinct-voter count within it).
const group = {day: '2026-07-02', count: votes.length, voters: 5, votes};

const meta: Meta<typeof DayGroup> = {
  title: 'Features/AdminAnalytics/DayGroup',
  component: DayGroup,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Collapsed: Story = {args: {group, maxCount: 8}};
export const Expanded: Story = {args: {group, maxCount: 8, defaultOpen: true}};
