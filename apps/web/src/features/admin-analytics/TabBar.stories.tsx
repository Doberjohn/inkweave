import type {Meta, StoryObj} from '@storybook/react-vite';
import {TabBar} from './TabBar';

const meta: Meta<typeof TabBar> = {
  title: 'Features/AdminAnalytics/TabBar',
  component: TabBar,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Calibration: Story = {args: {active: 'calibration', onChange: () => {}}};
export const Activity: Story = {args: {active: 'activity', onChange: () => {}}};
