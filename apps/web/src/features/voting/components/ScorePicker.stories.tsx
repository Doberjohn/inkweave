import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {ScorePicker} from './ScorePicker';

const meta = {
  title: 'Voting/ScorePicker',
  component: ScorePicker,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  args: {
    onChange: fn(),
  },
} satisfies Meta<typeof ScorePicker>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    value: null,
  },
};

export const Selected: Story = {
  args: {
    value: 7,
  },
};

export const Mobile: Story = {
  args: {
    value: null,
    isMobile: true,
  },
};
