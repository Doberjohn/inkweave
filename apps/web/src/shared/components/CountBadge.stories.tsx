import type {Meta, StoryObj} from '@storybook/react-vite';
import {CountBadge} from './CountBadge';

const meta: Meta<typeof CountBadge> = {
  title: 'Components/CountBadge',
  component: CountBadge,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleDigit: Story = {
  args: {count: 3},
};

export const DoubleDigit: Story = {
  args: {count: 12},
};

export const Zero: Story = {
  args: {count: 0},
};
