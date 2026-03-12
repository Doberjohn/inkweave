import type {Meta, StoryObj} from '@storybook/react-vite';
import type {SynergyGroup, SynergyMatchDisplay} from '../types';
import type {LorcanaCard} from '../../cards';
import {SynergyBreakdown} from './SynergyBreakdown';

const card = (id: string, ink: string): LorcanaCard =>
  ({id, name: 'Card', fullName: `Card ${id}`, ink, cost: 3, type: 'Character'}) as LorcanaCard;

const match = (id: string, ink: string, score: number): SynergyMatchDisplay => ({
  card: card(id, ink),
  score,
  explanation: 'Test synergy explanation',
});

const mockGroups: SynergyGroup[] = [
  {
    groupKey: 'shift-targets',
    category: 'direct',
    label: 'Shift Targets',
    description: 'Cards that share a name for Shift cost reduction',
    synergies: [match('1', 'Sapphire', 10), match('2', 'Sapphire', 8), match('3', 'Sapphire', 7)],
  },
  {
    groupKey: 'lore-denial',
    category: 'playstyle',
    label: 'Lore Denial',
    description: 'Cards that prevent opponents from gaining lore',
    synergies: [
      match('4', 'Amethyst', 6),
      match('5', 'Amethyst', 5),
      match('6', 'Ruby', 5),
      match('7', 'Ruby', 4),
      match('8', 'Ruby', 4),
    ],
  },
  {
    groupKey: 'bounce',
    category: 'playstyle',
    label: 'Bounce',
    description: 'Return cards to hand for ETB triggers',
    synergies: [match('9', 'Emerald', 7), match('10', 'Emerald', 6)],
  },
];

const meta: Meta<typeof SynergyBreakdown> = {
  title: 'Features/SynergyBreakdown',
  component: SynergyBreakdown,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    synergies: mockGroups,
    totalCount: 10,
  },
};

export const SingleGroup: Story = {
  args: {
    synergies: [mockGroups[0]],
    totalCount: 3,
  },
};

export const Empty: Story = {
  args: {
    synergies: [],
    totalCount: 0,
  },
};
