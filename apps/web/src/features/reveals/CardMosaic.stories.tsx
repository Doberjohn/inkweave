import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardMosaic} from './CardMosaic';

const meta: Meta<typeof CardMosaic> = {
  title: 'Features/Reveals/CardMosaic',
  component: CardMosaic,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Real committed Set 13 preview ids, so the slot images load in Storybook.
const IMG_IDS = [
  2973, 2976, 2977, 2978, 2980, 2988, 2992, 2995, 2997, 2999, 3000, 3001, 3002, 3004,
  3005, 3008, 3009, 3011, 3015, 3020, 3022, 3023, 3029, 3030, 3031, 3032, 3036, 3038,
  3039, 3045, 3046, 3050, 3053, 3054,
];

// Each ink's first collector number (mirrors CardMosaic's INK_BASE), so mock
// setNumbers land in-range and the cards place on the 38-slot board.
const INK_BASE: Record<Ink, number> = {
  Amber: 1,
  Amethyst: 38,
  Emerald: 74,
  Ruby: 113,
  Sapphire: 148,
  Steel: 178,
};

function cards(n: number, ink: Ink = 'Amber'): LorcanaCard[] {
  return IMG_IDS.slice(0, n).map(
    (id, i) =>
      ({
        id: String(id),
        name: 'Card',
        fullName: `Card ${id}`,
        cost: (i % 9) + 1,
        ink,
        inkwell: true,
        type: 'Character',
        imageUrl: `/card-images-preview/${id}.avif`,
        setCode: '13',
        // Anchor on the ink's base so cards fill from the first slot of the board.
        setNumber: INK_BASE[ink] + i,
      }) as LorcanaCard,
  );
}

export const Partial: Story = {
  args: {ink: 'Amber', cards: cards(20), onOpen: () => {}},
};

export const Complete: Story = {
  args: {ink: 'Emerald', cards: cards(34, 'Emerald'), onOpen: () => {}},
};

export const Empty: Story = {
  args: {ink: 'Sapphire', cards: []},
};

export const Mobile: Story = {
  args: {ink: 'Ruby', cards: cards(20, 'Ruby'), compact: true, onOpen: () => {}},
};
