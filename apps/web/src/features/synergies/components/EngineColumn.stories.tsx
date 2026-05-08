import type {Meta, StoryObj} from '@storybook/react-vite';
import type {DetailedPairSynergy, LorcanaCard} from 'inkweave-synergy-engine';
import {EngineColumn} from './EngineColumn';

const cardA: LorcanaCard = {
  id: '1004',
  name: 'Elsa',
  fullName: 'Elsa - The Fifth Spirit',
  version: 'The Fifth Spirit',
  ink: 'Amethyst',
  type: 'Character',
  cost: 5,
  inkwell: true,
  rarity: 'Super Rare',
  set: 5,
  number: 48,
  strength: 2,
  willpower: 5,
  lore: 0,
  textSections: ['Rush', 'Evasive'],
} as unknown as LorcanaCard;

const cardB: LorcanaCard = {
  id: '1979',
  name: 'Elsa',
  fullName: 'Elsa - Spirit of Winter',
  version: 'Spirit of Winter',
  ink: 'Amethyst',
  type: 'Character',
  cost: 8,
  inkwell: false,
  rarity: 'Legendary',
  set: 9,
  number: 43,
  strength: 4,
  willpower: 6,
  lore: 0,
  textSections: ['Shift 6'],
} as unknown as LorcanaCard;

const singleRulePair: DetailedPairSynergy = {
  cardA,
  cardB,
  aggregateScore: 9,
  connections: [
    {
      ruleId: 'shift-targets',
      ruleName: 'Shift Targets',
      category: 'direct',
      score: 9,
      explanation: 'Free Shift. Play A early, then shift B in for 0 ink.',
    },
  ],
};

const multiRulePair: DetailedPairSynergy = {
  cardA,
  cardB,
  aggregateScore: 8,
  connections: [
    {
      ruleId: 'location-at-payoff',
      ruleName: 'At Payoff',
      category: 'playstyle',
      playstyleId: 'location-control',
      score: 8,
      explanation: 'Both cards reward filling locations.',
    },
    {
      ruleId: 'location-move',
      ruleName: 'Move',
      category: 'playstyle',
      playstyleId: 'location-control',
      score: 6,
      explanation: 'Move characters to locations for positioning.',
    },
  ],
};

const meta = {
  title: 'Synergies/EngineColumn',
  component: EngineColumn,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 420, padding: 0}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof EngineColumn>;
export default meta;
type Story = StoryObj<typeof meta>;

export const SingleRulePerfect: Story = {
  args: {pair: singleRulePair, engineScore: 9},
};

export const MultipleRoles: Story = {
  args: {pair: multiRulePair, engineScore: 8},
};
