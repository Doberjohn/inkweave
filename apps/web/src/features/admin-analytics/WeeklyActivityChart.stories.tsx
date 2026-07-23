import type {Meta, StoryObj} from '@storybook/react-vite';
import {WeeklyActivityChart} from './WeeklyActivityChart';

const meta: Meta<typeof WeeklyActivityChart> = {
  title: 'Features/AdminAnalytics/WeeklyActivityChart',
  component: WeeklyActivityChart,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const WEEKS = [150, 102, 49, 286, 271, 163, 101, 205, 98, 52, 3, 18, 66, 252].map((votes, i) => ({
  week: `2026-${String(3 + Math.floor(i / 4)).padStart(2, '0')}-${String(1 + i).padStart(2, '0')}`,
  votes,
  meanGap: -0.3,
}));

export const Default: Story = {args: {weekly: WEEKS, latestDate: '2026-06-18'}};
export const WithoutLatest: Story = {args: {weekly: WEEKS}};
