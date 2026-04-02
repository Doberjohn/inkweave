import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {VoteToast} from './VoteToast';
import type {VoteToastData} from './VoteToast';

const baseData: VoteToastData = {
  cardAName: 'Elsa - Snow Queen',
  cardBName: 'Elsa - Ice Sorceress',
  userScore: 7,
  engineScore: 7,
};

const meta = {
  title: 'Voting/VoteToast',
  component: VoteToast,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    onDismiss: fn(),
  },
} satisfies Meta<typeof VoteToast>;

export default meta;
type Story = StoryObj<typeof meta>;

export const ExactMatch: Story = {
  args: {
    data: baseData,
  },
};

export const CloseMatch: Story = {
  args: {
    data: {...baseData, userScore: 8, engineScore: 7},
  },
};

export const HotTake: Story = {
  args: {
    data: {...baseData, userScore: 10, engineScore: 3},
  },
};

export const WithUndo: Story = {
  args: {
    data: baseData,
    onUndo: fn(),
  },
};

export const Mobile: Story = {
  args: {
    data: baseData,
    isMobile: true,
  },
};
