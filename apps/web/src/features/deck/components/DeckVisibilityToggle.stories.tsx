import type {Meta, StoryObj} from '@storybook/react-vite';
import {fn} from 'storybook/test';
import {DeckVisibilityToggle} from './DeckVisibilityToggle';

const meta: Meta<typeof DeckVisibilityToggle> = {
  title: 'Deck/DeckVisibilityToggle',
  component: DeckVisibilityToggle,
  tags: ['autodocs'],
  args: {isPublic: false, onChange: fn()},
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The default for every new deck. */
export const Private: Story = {};

/** Public decks appear in the community tab once saved, provided they are Core legal. */
export const Public: Story = {args: {isPublic: true}};
