import type {Meta, StoryObj} from '@storybook/react-vite';
import {ConnectionGroup} from './ConnectionGroup';
import type {ConnectionGroupData} from './groupConnections';

const mockCardA = {
  id: '1004',
  name: 'Elsa',
  fullName: 'Elsa - The Fifth Spirit',
  version: 'The Fifth Spirit',
  ink: 'Amethyst' as const,
  type: 'Character' as const,
  cost: 5,
  inkwell: true,
  rarity: 'Super Rare' as const,
  set: 5,
  number: 48,
  strength: 2,
  willpower: 5,
  lore: 0,
  textSections: ['Rush', 'Evasive', 'CRYSTALLIZE When you play this character, exert chosen opposing character.'],
};

const mockCardB = {
  id: '1979',
  name: 'Elsa',
  fullName: 'Elsa - Spirit of Winter',
  version: 'Spirit of Winter',
  ink: 'Amethyst' as const,
  type: 'Character' as const,
  cost: 8,
  inkwell: false,
  rarity: 'Legendary' as const,
  set: 9,
  number: 43,
  strength: 4,
  willpower: 6,
  lore: 0,
  textSections: ['Shift 6', 'DEEP FREEZE When you play this character, exert up to 2 chosen characters.'],
};

const directGroup: ConnectionGroupData = {
  key: 'shift-targets',
  label: 'Shift Targets',
  score: 8,
  connections: [{
    ruleId: 'shift-targets',
    ruleName: 'Shift Targets',
    category: 'direct',
    score: 8,
    explanation: 'Perfect curve: Play Elsa - The Fifth Spirit on turn 5, Shift next turn. One card is inkable as fallback.',
  }],
  category: 'direct',
};

const multiRoleGroup: ConnectionGroupData = {
  key: 'location-control',
  label: 'Locations',
  score: 7,
  connections: [
    {
      ruleId: 'location-at-payoff',
      ruleName: 'At Payoff',
      category: 'playstyle',
      playstyleId: 'location-control',
      score: 7,
      explanation: 'Elsa gets bonuses when characters are at a location',
    },
    {
      ruleId: 'location-move',
      ruleName: 'Move',
      category: 'playstyle',
      playstyleId: 'location-control',
      score: 5,
      explanation: 'Elsa moves characters to locations for positioning advantage',
    },
  ],
  category: 'playstyle',
};

const meta = {
  title: 'Shared/ConnectionGroup',
  component: ConnectionGroup,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 500, background: '#1a1a2e', padding: 24, borderRadius: 12}}>
        <Story />
      </div>
    ),
  ],
} satisfies Meta<typeof ConnectionGroup>;

export default meta;
type Story = StoryObj<typeof meta>;

export const DirectRule: Story = {
  args: {
    group: directGroup,
    cardA: mockCardA,
    cardB: mockCardB,
  },
};

export const MultipleRoles: Story = {
  args: {
    group: multiRoleGroup,
    cardA: mockCardA,
    cardB: mockCardB,
  },
};
