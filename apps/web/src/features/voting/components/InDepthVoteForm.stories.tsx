import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {InDepthVoteForm} from './InDepthVoteForm';
import {createCard} from '../../../shared/test-utils/factories';

const cardA = createCard({id: 'elsa-1', fullName: 'Elsa - Snow Queen', ink: 'Amethyst'});
const cardB = createCard({id: 'olaf-1', fullName: 'Olaf - Friendly Snowman', ink: 'Amethyst'});

const meta = {
  title: 'Voting/InDepthVoteForm',
  component: InDepthVoteForm,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 560, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
  args: {
    cardA,
    cardB,
    onSetIsReal: fn(),
    onSetAccuracy: fn(),
    onSetScore: fn(),
    onSetWouldPlay: fn(),
    onSetWhoCarries: fn(),
    onSetDifficulty: fn(),
  },
} satisfies Meta<typeof InDepthVoteForm>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  args: {
    formState: {
      isReal: null,
      accuracy: null,
      score: null,
      wouldPlay: null,
      whoCarries: null,
      difficulty: null,
    },
  },
};

export const PartiallyFilled: Story = {
  args: {
    formState: {
      isReal: true,
      accuracy: null,
      score: 7,
      wouldPlay: null,
      whoCarries: 'both',
      difficulty: null,
    },
  },
};

export const FullyFilled: Story = {
  args: {
    formState: {
      isReal: true,
      accuracy: 0,
      score: 8,
      wouldPlay: true,
      whoCarries: 'a',
      difficulty: 2,
    },
  },
};

export const Mobile: Story = {
  args: {
    formState: {
      isReal: null,
      accuracy: null,
      score: null,
      wouldPlay: null,
      whoCarries: null,
      difficulty: null,
    },
    isMobile: true,
  },
  globals: {viewport: {value: 'mobile1'}},
};
