import type {Meta, StoryObj} from '@storybook/react-vite';
import {PairList} from './PairList';
import type {PairStat} from './voteAnalyticsTypes';

const meta: Meta<typeof PairList> = {
  title: 'Features/AdminAnalytics/PairList',
  component: PairList,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const pair = (
  a: string,
  b: string,
  aName: string,
  bName: string,
  engineScore: number,
  communityScore: number,
  scoreVotes: number,
): PairStat => ({
  a,
  b,
  aName,
  bName,
  engineScore,
  communityScore,
  gap: communityScore - engineScore,
  scoreVotes,
  rules: ['ramp'],
});

const PAIRS: PairStat[] = [
  pair('crd_a', 'crd_b', 'Sisu - Divine Water Dragon', 'Raya - Leader of Heart', 8, 5, 3),
  pair('crd_c', 'crd_d', 'Maui - Hero to All', 'Moana - Of Motunui', 7, 4, 1),
  pair('crd_e', 'crd_f', 'Elsa - Snow Queen', 'Anna - Heir to Arendelle', 6, 5, 1),
  pair('crd_g', 'crd_h', 'Mickey Mouse - Brave Little Tailor', 'Donald Duck - Boisterous Fowl', 9, 6, 2),
];

const noop = () => {};

export const Default: Story = {args: {pairs: PAIRS, selectedPair: null, onSelectPair: noop}};
export const WithSelection: Story = {
  args: {pairs: PAIRS, selectedPair: {a: 'crd_c', b: 'crd_d'}, onSelectPair: noop},
};
