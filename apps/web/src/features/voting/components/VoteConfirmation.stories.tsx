import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {VoteConfirmation} from './VoteConfirmation';

const meta = {
  title: 'Voting/VoteConfirmation',
  component: VoteConfirmation,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  args: {
    onComplete: fn(),
  },
} satisfies Meta<typeof VoteConfirmation>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    score: 8,
    engineScore: 7,
    whoCarries: null,
    cardAName: 'Elsa - Snow Queen',
    cardBName: 'Elsa - Ice Sorceress',
  },
};

export const BothCarries: Story = {
  args: {
    score: 7,
    engineScore: 7,
    whoCarries: 'both',
    cardAName: 'Elsa - Snow Queen',
    cardBName: 'Elsa - Ice Sorceress',
  },
};

export const CardACarries: Story = {
  args: {
    score: 9,
    engineScore: 8,
    whoCarries: 'a',
    cardAName: 'Elsa - Snow Queen',
    cardBName: 'Elsa - Ice Sorceress',
  },
};
