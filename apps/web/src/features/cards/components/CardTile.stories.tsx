import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {CardTile} from './CardTile';
import {CardPreviewProvider} from './CardPreviewProvider';
import type {LorcanaCard} from '../types';

const createMockCard = (overrides: Partial<LorcanaCard> = {}): LorcanaCard => ({
  id: '1',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  cost: 5,
  ink: 'Sapphire',
  inkwell: true,
  type: 'Character',
  classifications: ['Floodborn', 'Princess'],
  keywords: ['Singer 5', 'Evasive'],
  text: 'When you play this character, draw 2 cards.',
  strength: 3,
  willpower: 4,
  lore: 2,
  imageUrl: 'https://lorcana-api.com/images/tfc/1/en/full.webp',
  setCode: '1',
  setNumber: 42,
  ...overrides,
});

const meta: Meta<typeof CardTile> = {
  title: 'Components/CardTile',
  component: CardTile,
  decorators: [
    (Story) => (
      <CardPreviewProvider>
        <div style={{width: '300px'}}>
          <Story />
        </div>
      </CardPreviewProvider>
    ),
  ],
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  args: {
    onClick: fn(),
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  args: {
    card: createMockCard(),
    isSelected: false,
  },
};

export const Selected: Story = {
  args: {
    card: createMockCard(),
    isSelected: true,
  },
};

export const ActionCard: Story = {
  args: {
    card: createMockCard({
      name: 'Let It Go',
      version: undefined,
      fullName: 'Let It Go',
      type: 'Action',
      classifications: ['Song'],
      keywords: undefined,
      strength: undefined,
      willpower: undefined,
      lore: undefined,
    }),
    isSelected: false,
  },
};

export const ItemCard: Story = {
  args: {
    card: createMockCard({
      name: 'Magic Broom',
      version: 'Bucket Brigade',
      fullName: 'Magic Broom - Bucket Brigade',
      type: 'Item',
      ink: 'Amber',
      cost: 2,
      classifications: undefined,
      keywords: ['Broom'],
    }),
    isSelected: false,
  },
};

export const AllInkColors: Story = {
  render: () => (
    <CardPreviewProvider>
      <div style={{display: 'flex', flexDirection: 'column', gap: '8px', width: '300px'}}>
        {(['Amber', 'Amethyst', 'Emerald', 'Ruby', 'Sapphire', 'Steel'] as const).map((ink) => (
          <CardTile
            key={ink}
            card={createMockCard({ink, name: `${ink} Character`})}
            isSelected={false}
            onClick={fn()}
          />
        ))}
      </div>
    </CardPreviewProvider>
  ),
};
