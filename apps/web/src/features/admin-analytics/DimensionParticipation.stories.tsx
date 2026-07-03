import type {Meta, StoryObj} from '@storybook/react-vite';
import {DimensionParticipation} from './DimensionParticipation';

const meta: Meta<typeof DimensionParticipation> = {
  title: 'Features/AdminAnalytics/DimensionParticipation',
  component: DimensionParticipation,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {fill: {score: 1730, accuracy: 115, isReal: 24, wouldPlay: 24, difficulty: 24}, totalVotes: 1823},
};
