import type {Meta, StoryObj} from '@storybook/react-vite';
import {RawVotesNotice} from './RawVotesNotice';

const meta: Meta<typeof RawVotesNotice> = {
  title: 'Features/AdminAnalytics/RawVotesNotice',
  component: RawVotesNotice,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
