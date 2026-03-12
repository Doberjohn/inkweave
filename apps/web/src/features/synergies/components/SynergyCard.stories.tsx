import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from '../../cards';
import {CardPreviewProvider} from '../../cards/components/CardPreviewContext';
import {SynergyCard} from './SynergyCard';

const mockCard = (ink: string, overrides: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '1',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 5,
  ink,
  inkwell: true,
  type: 'Character',
  classifications: ['Floodborn', 'Princess'],
  keywords: ['Singer 5'],
  text: 'When you play this character, draw 2 cards.',
  strength: 3,
  willpower: 4,
  lore: 2,
  setCode: '5',
  setNumber: 42,
  ...overrides,
});

const meta: Meta<typeof SynergyCard> = {
  title: 'Features/SynergyCard',
  component: SynergyCard,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <div style={{width: 160}}>
          <Story />
        </div>
      </CardPreviewProvider>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Perfect: Story = {
  args: {
    card: mockCard('Sapphire'),
    score: 10,
    explanation: 'Shift onto same-named base character with perfect curve alignment',
  },
};

export const Strong: Story = {
  args: {
    card: mockCard('Emerald', {name: 'Robin Hood', fullName: 'Robin Hood - Outlaw'}),
    score: 7,
    explanation: 'Both cards benefit from bouncing creatures to hand',
  },
};

export const Moderate: Story = {
  args: {
    card: mockCard('Ruby', {name: 'Gaston', fullName: 'Gaston - Arrogant Hunter'}),
    score: 5,
    explanation: 'Deals damage that triggers removal payoffs',
  },
};

export const Weak: Story = {
  args: {
    card: mockCard('Amber', {name: 'Rapunzel', fullName: 'Rapunzel - Gifted with Healing'}),
    score: 3,
    explanation: 'Minor lore acceleration synergy',
  },
};

export const MobileVariant: Story = {
  args: {
    card: mockCard('Amethyst'),
    score: 8,
    explanation: 'Discard synergy with hand manipulation',
    isMobile: true,
  },
};

export const WithCardClick: Story = {
  args: {
    card: mockCard('Steel', {name: 'Magic Broom', fullName: 'Magic Broom - Bucket Brigade'}),
    score: 6,
    explanation: 'Item synergy with character abilities',
    onCardClick: fn(),
  },
};
