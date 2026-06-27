import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardMosaic} from './CardMosaic';

const meta: Meta<typeof CardMosaic> = {
  title: 'Features/Reveals/CardMosaic',
  component: CardMosaic,
  parameters: {backgrounds: {default: 'dark'}, layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Real committed Set 13 preview ids, so the slot images load in Storybook.
const IMG_IDS = [
  13002, 13005, 13006, 13007, 13009, 13017, 13021, 13024, 13026, 13028, 13029, 13030, 13031, 13033,
  13034, 13037, 13038, 13040, 13044, 13049, 13051, 13052, 13058, 13059, 13060, 13061, 13065, 13067,
  13068, 13074, 13075, 13079, 13082, 13083,
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
