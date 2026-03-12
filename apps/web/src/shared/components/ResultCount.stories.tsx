import type {Meta, StoryObj} from '@storybook/react-vite';
import {ResultCount} from './ResultCount';

const meta: Meta<typeof ResultCount> = {
  title: 'Components/ResultCount',
  component: ResultCount,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const AllCards: Story = {
  args: {resultCount: 482, totalCount: 482},
};

export const Filtered: Story = {
  args: {resultCount: 37, totalCount: 482},
};

export const SingleResult: Story = {
  args: {resultCount: 1, totalCount: 482},
};
