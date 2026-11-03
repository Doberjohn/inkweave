import type {Meta, StoryObj} from '@storybook/react-vite';
import {CardFacts} from './CardFacts';
import {createCard} from '../../../shared/test-utils';

const meta: Meta<typeof CardFacts> = {
  title: 'Cards/CardFacts',
  component: CardFacts,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  decorators: [(Story) => <div style={{maxWidth: 360}}>{Story()}</div>],
};

export default meta;
type Story = StoryObj<typeof CardFacts>;

export const Character: Story = {
  args: {
    card: createCard({
      fullName: 'Sven - Official Ice Deliverer',
      cost: 6,
      ink: 'Amethyst',
      classifications: ['Storyborn', 'Ally'],
      strength: 5,
      willpower: 7,
      lore: 1,
      setCode: '9',
      setNumber: 56,
    }),
  },
};

export const Song: Story = {
  args: {
    card: createCard({
      fullName: 'Circle of Life',
      cost: 8,
      type: 'Action',
      isSong: true,
      setCode: '9',
      setNumber: 26,
    }),
  },
};
