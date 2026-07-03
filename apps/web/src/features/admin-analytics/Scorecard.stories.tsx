import type {Meta, StoryObj} from '@storybook/react-vite';
import {Scorecard, ScorecardRow} from './Scorecard';

const meta: Meta<typeof Scorecard> = {
  title: 'Features/AdminAnalytics/Scorecard',
  component: Scorecard,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Single: Story = {args: {value: '1,823', label: 'Total votes'}};
export const Emphasis: Story = {args: {value: '196', label: 'Engine-silent pairs', hint: 'voted, no synergy', emphasis: true}};

export const Row: Story = {
  render: () => (
    <ScorecardRow>
      <Scorecard value="1,823" label="Total votes" />
      <Scorecard value="1,724" label="Pairs covered" />
      <Scorecard value="196" label="Engine-silent pairs" hint="voted, no synergy" emphasis />
      <Scorecard value="82" label="Distinct voters" rawTag />
    </ScorecardRow>
  ),
};
