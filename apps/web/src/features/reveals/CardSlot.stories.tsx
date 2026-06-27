import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';

const meta: Meta<typeof CardSlot> = {
  title: 'Features/Reveals/CardSlot',
  component: CardSlot,
  parameters: {backgrounds: {default: 'dark'}},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

function card(id: number, ink: Ink, cost: number, rarity: string): LorcanaCard {
  return {
    id: String(id),
    name: 'Card',
    fullName: `Card ${id}`,
    cost,
    ink,
    inkwell: true,
    type: 'Character',
    imageUrl: `/card-images-preview/${id}.avif`,
    rarity,
    setCode: '13',
  } as LorcanaCard;
}

export const Revealed: Story = {
  args: {ink: 'Amber', card: card(13002, 'Amber', 3, 'Rare'), onOpen: () => {}},
};

export const Unrevealed: Story = {
  args: {ink: 'Amethyst'},
};

export const Mobile: Story = {
  args: {ink: 'Ruby', card: card(13129, 'Ruby', 7, 'Super Rare'), width: 46, height: 64, onOpen: () => {}},
};

// A mosaic row mixing revealed (varied rarities) and unrevealed slots.
export const Row: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 7, padding: 16}}>
      <CardSlot ink="Amber" card={card(13002, 'Amber', 3, 'Common')} onOpen={() => {}} />
      <CardSlot ink="Amber" card={card(13017, 'Amber', 5, 'Super Rare')} onOpen={() => {}} />
      <CardSlot ink="Amber" />
      <CardSlot ink="Amber" card={card(13024, 'Amber', 6, 'Legendary')} onOpen={() => {}} />
      <CardSlot ink="Amber" />
      <CardSlot ink="Amber" card={card(13009, 'Amber', 2, 'Uncommon')} onOpen={() => {}} />
      <CardSlot ink="Amber" card={card(13005, 'Amber', 4, 'Rare')} onOpen={() => {}} />
    </div>
  ),
};
