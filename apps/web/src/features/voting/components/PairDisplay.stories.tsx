import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard, PairSynergyConnection} from 'inkweave-synergy-engine';
import type {VotingPair} from '../types';
import {PairDisplay} from './PairDisplay';

const mockCardA: LorcanaCard = {
  id: 'story-pair-a',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 5,
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

const mockCardB: LorcanaCard = {
  id: 'story-pair-b',
  name: 'Elsa',
  version: 'Ice Sorceress',
  fullName: 'Elsa - Ice Sorceress',
  cost: 3,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  classifications: ['Storyborn', 'Princess'],
  text: 'Exert - Deal 1 damage to chosen character.',
  strength: 2,
  willpower: 3,
  lore: 1,
  setCode: '5',
  setNumber: 57,
};

const mockConnection: PairSynergyConnection = {
  ruleId: 'shift-targets',
  ruleName: 'Shift Targets',
  category: 'direct' as const,
  score: 8,
  explanation: 'Elsa - Snow Queen can shift onto Elsa - Ice Sorceress for reduced cost',
};

const mockPair: VotingPair = {
  cardA: mockCardA,
  cardB: mockCardB,
  aggregateScore: 8,
  connections: [mockConnection],
};

const meta = {
  title: 'Voting/PairDisplay',
  component: PairDisplay,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 900}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof PairDisplay>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    pair: mockPair,
    selectedScore: null,
  },
};

export const WithScore: Story = {
  args: {
    pair: mockPair,
    selectedScore: 8,
  },
};

export const Mobile: Story = {
  args: {
    pair: mockPair,
    selectedScore: null,
    isMobile: true,
  },
};
