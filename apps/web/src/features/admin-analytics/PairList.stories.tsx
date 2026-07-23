import type {Meta, StoryObj} from '@storybook/react-vite';
import {PairList} from './PairList';
import type {PairStat} from './voteAnalyticsTypes';

const meta: Meta<typeof PairList> = {
  title: 'Features/AdminAnalytics/PairList',
  component: PairList,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const DEFAULT_PAIR: PairStat = {
  a: 'a',
  b: 'b',
  aName: '',
  bName: '',
  engineScore: 0,
  communityScore: 0,
  gap: 0,
  scoreVotes: 1,
  rules: ['ramp'],
};

/** Build a PairStat fixture; gap defaults to communityScore - engineScore. */
const pair = (p: Partial<PairStat>): PairStat => {
  const merged = {...DEFAULT_PAIR, ...p};
  return {...merged, gap: p.gap ?? merged.communityScore - merged.engineScore};
};

const PAIRS: PairStat[] = [
  pair({a: 'crd_a', b: 'crd_b', aName: 'Sisu - Divine Water Dragon', bName: 'Raya - Leader of Heart', engineScore: 8, communityScore: 5, scoreVotes: 3}),
  pair({a: 'crd_c', b: 'crd_d', aName: 'Maui - Hero to All', bName: 'Moana - Of Motunui', engineScore: 7, communityScore: 4, scoreVotes: 1}),
  pair({a: 'crd_e', b: 'crd_f', aName: 'Elsa - Snow Queen', bName: 'Anna - Heir to Arendelle', engineScore: 6, communityScore: 5, scoreVotes: 1}),
  pair({a: 'crd_g', b: 'crd_h', aName: 'Mickey Mouse - Brave Little Tailor', bName: 'Donald Duck - Boisterous Fowl', engineScore: 9, communityScore: 6, scoreVotes: 2}),
];

const noop = () => {};

export const Default: Story = {args: {pairs: PAIRS, selectedPair: null, onSelectPair: noop}};
export const WithSelection: Story = {
  args: {pairs: PAIRS, selectedPair: {a: 'crd_c', b: 'crd_d'}, onSelectPair: noop},
};
