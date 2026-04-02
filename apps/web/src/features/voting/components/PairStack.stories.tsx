import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {PairPreview} from '../hooks/usePairQueue';
import {PairStack} from './PairStack';

const createMockCard = (id: string, name: string, ink: string): LorcanaCard => ({
  id,
  name,
  fullName: name,
  cost: 4,
  ink,
  inkwell: true,
  type: 'Character',
  setCode: '5',
  setNumber: 1,
});

const mockPairs: PairPreview[] = [
  {
    cardA: createMockCard('stack-1a', 'Elsa - Snow Queen', 'Sapphire'),
    cardB: createMockCard('stack-1b', 'Anna - Brave Princess', 'Amber'),
  },
  {
    cardA: createMockCard('stack-2a', 'Robin Hood - Outlaw', 'Emerald'),
    cardB: createMockCard('stack-2b', 'Little John - Loyal Friend', 'Emerald'),
  },
];

const meta = {
  title: 'Voting/PairStack',
  component: PairStack,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
} satisfies Meta<typeof PairStack>;

export default meta;
type Story = StoryObj<typeof meta>;

export const RightSide: Story = {
  args: {
    pairs: mockPairs,
    side: 'right',
  },
};

export const LeftSide: Story = {
  args: {
    pairs: mockPairs,
    side: 'left',
  },
};

export const Empty: Story = {
  args: {
    pairs: [],
    side: 'right',
  },
};
