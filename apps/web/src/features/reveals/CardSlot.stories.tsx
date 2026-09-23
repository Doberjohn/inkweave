import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardSlot} from './CardSlot';

const meta: Meta<typeof CardSlot> = {
  title: 'Features/Reveals/CardSlot',
  component: CardSlot,
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Season-independent art (stories.md #512): preview AVIFs are deleted when a set
// graduates, so a story pointed at them rots every season.
const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';

function card(id: number, ink: Ink, cost: number, rarity: string): LorcanaCard {
  return {
    id: String(id),
    name: 'Card',
    fullName: `Card ${id}`,
    cost,
    ink,
    inkwell: true,
    type: 'Character',
    imageUrl: SAMPLE_IMG,
    rarity,
    setCode: '9',
  } as LorcanaCard;
}

export const Revealed: Story = {
  args: {ink: 'Amber', card: card(1, 'Amber', 3, 'Rare'), onOpen: () => {}},
};

export const Unrevealed: Story = {
  args: {ink: 'Amethyst'},
};

export const Mobile: Story = {
  args: {ink: 'Ruby', card: card(2, 'Ruby', 7, 'Super Rare'), width: 46, height: 64, onOpen: () => {}},
};

// A mosaic row mixing revealed (varied rarities) and unrevealed slots.
export const Row: Story = {
  render: () => (
    <div style={{display: 'flex', gap: 7, padding: 16}}>
      <CardSlot ink="Amber" card={card(1, 'Amber', 3, 'Common')} onOpen={() => {}} />
      <CardSlot ink="Amber" card={card(2, 'Amber', 5, 'Super Rare')} onOpen={() => {}} />
      <CardSlot ink="Amber" />
      <CardSlot ink="Amber" card={card(3, 'Amber', 6, 'Legendary')} onOpen={() => {}} />
      <CardSlot ink="Amber" />
      <CardSlot ink="Amber" card={card(4, 'Amber', 2, 'Uncommon')} onOpen={() => {}} />
      <CardSlot ink="Amber" card={card(5, 'Amber', 4, 'Rare')} onOpen={() => {}} />
    </div>
  ),
};
