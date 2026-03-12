import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import type {LorcanaCard} from '../../cards';
import {CardDetail} from './CardDetail';

const createCard = (overrides: Partial<LorcanaCard> = {}): LorcanaCard => ({
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
  textSections: [{type: 'ability', text: 'When you play this character, draw 2 cards.'}],
  strength: 3,
  willpower: 4,
  lore: 2,
  setCode: '5',
  setNumber: 42,
  ...overrides,
});

const meta: Meta<typeof CardDetail> = {
  title: 'Features/CardDetail',
  component: CardDetail,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
  decorators: [
    (Story) => (
      <div style={{width: 600}}>
        <Story />
      </div>
    ),
  ],
  args: {onClear: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

export const Character: Story = {
  args: {card: createCard()},
};

export const Action: Story = {
  args: {
    card: createCard({
      name: 'Let It Go',
      version: undefined,
      fullName: 'Let It Go',
      type: 'Action',
      ink: 'Amethyst',
      cost: 4,
      classifications: ['Song'],
      keywords: undefined,
      strength: undefined,
      willpower: undefined,
      lore: undefined,
      text: "Return chosen character to their player's hand.",
      textSections: [{type: 'ability', text: "Return chosen character to their player's hand."}],
    }),
  },
};

export const Item: Story = {
  args: {
    card: createCard({
      name: 'Magic Broom',
      version: 'Bucket Brigade',
      fullName: 'Magic Broom - Bucket Brigade',
      type: 'Item',
      ink: 'Amber',
      cost: 2,
      classifications: undefined,
      keywords: ['Broom'],
      strength: undefined,
      willpower: undefined,
      lore: undefined,
    }),
  },
};

export const NoText: Story = {
  args: {
    card: createCard({
      text: undefined,
      textSections: undefined,
    }),
  },
};
