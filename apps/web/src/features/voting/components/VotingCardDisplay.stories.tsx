import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {VotingCardDisplay} from './VotingCardDisplay';

const mockCard: LorcanaCard = {
  id: 'story-1',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 4,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  classifications: ['Floodborn', 'Princess'],
  text: 'When you play this character, draw 2 cards.',
  strength: 3,
  willpower: 4,
  lore: 2,
  setCode: '5',
  setNumber: 58,
};

const meta = {
  title: 'Voting/VotingCardDisplay',
  component: VotingCardDisplay,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta<typeof VotingCardDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: mockCard,
  },
};

export const Mobile: Story = {
  args: {
    card: mockCard,
    isMobile: true,
  },
};

export const Highlighted: Story = {
  args: {
    card: mockCard,
    highlighted: true,
  },
};
