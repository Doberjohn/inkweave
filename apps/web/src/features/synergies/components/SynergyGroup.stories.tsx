import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {SynergyGroup as SynergyGroupData, SynergyMatchDisplay} from '../types';
import type {LorcanaCard} from '../../cards';
import {CardPreviewProvider} from '../../cards/components/CardPreviewProvider';
import {SynergyGroup} from './SynergyGroup';

const inks = ['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'];

const card = (id: string, inkIndex: number): LorcanaCard =>
  ({
    id,
    name: `Card ${id}`,
    fullName: `Card ${id} - Version`,
    ink: inks[inkIndex % inks.length],
    cost: (parseInt(id) % 8) + 1,
    type: 'Character',
    inkwell: true,
    setCode: '5',
  }) as LorcanaCard;

const match = (id: string, inkIndex: number, score: number): SynergyMatchDisplay => ({
  card: card(id, inkIndex),
  score,
  explanation: `Synergy explanation for card ${id}`,
});

const mockGroup: SynergyGroupData = {
  groupKey: 'shift-targets',
  category: 'direct',
  label: 'Shift Targets',
  description: 'Cards that share a name, enabling the Shift keyword to reduce play cost.',
  synergies: [match('1', 0, 10), match('2', 0, 8), match('3', 1, 7), match('4', 2, 6)],
};

const largeGroup: SynergyGroupData = {
  ...mockGroup,
  groupKey: 'bounce',
  label: 'Bounce',
  description: 'Return characters to hand to trigger enter-the-board effects repeatedly.',
  synergies: Array.from({length: 12}, (_, i) => match(String(i + 1), i, 10 - Math.floor(i / 2))),
};

const meta: Meta<typeof SynergyGroup> = {
  title: 'Features/SynergyGroup',
  component: SynergyGroup,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <div style={{padding: 24, maxWidth: 800}}>
          <Story />
        </div>
      </CardPreviewProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {group: mockGroup},
};

export const WithOverflow: Story = {
  args: {
    group: largeGroup,
    maxVisibleCards: 6,
    onShowAll: fn(),
  },
};

export const NoHeader: Story = {
  args: {
    group: mockGroup,
    showHeader: false,
  },
};

export const Mobile: Story = {
  args: {
    group: mockGroup,
    isMobile: true,
  },
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <div style={{padding: 16, maxWidth: 390}}>
          <Story />
        </div>
      </CardPreviewProvider>
    ),
  ],
};
