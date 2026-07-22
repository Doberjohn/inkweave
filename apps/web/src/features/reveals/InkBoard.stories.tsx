import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkBoard} from './InkBoard';
import type {InkProgress} from './useRevealProgress';

const meta: Meta<typeof InkBoard> = {
  title: 'Features/Reveals/InkBoard',
  component: InkBoard,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
  // The board fills its container; on the real page that's the 1180px-max
  // content column, so preview it constrained rather than full-bleed.
  decorators: [
    (Story) => (
      <div style={{maxWidth: 1180, margin: '0 auto', width: '100%'}}>
        <Story />
      </div>
    ),
  ],
};
export default meta;
type Story = StoryObj<typeof meta>;

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

function progress(ink: Ink, count: number, rarityCounts: Record<string, number>): InkProgress {
  const cards = IMG_IDS.slice(0, count).map(
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
        setNumber: INK_BASE[ink] + i,
      }) as LorcanaCard,
  );
  return {ink, count, cards, rarityCounts};
}

export const Partial: Story = {
  args: {
    progress: progress('Amber', 20, {common: 6, uncommon: 5, rare: 6, 'super rare': 3, legendary: 1}),
    onOpen: () => {},
  },
};

export const Complete: Story = {
  args: {
    progress: progress('Emerald', 34, {common: 12, uncommon: 9, rare: 8, 'super rare': 3, legendary: 2}),
    onOpen: () => {},
  },
};

export const Early: Story = {
  args: {
    progress: progress('Steel', 8, {common: 2, uncommon: 4, rare: 1, 'super rare': 1, legendary: 0}),
    onOpen: () => {},
  },
};

export const Mobile: Story = {
  args: {
    progress: progress('Ruby', 15, {common: 3, uncommon: 3, rare: 5, 'super rare': 3, legendary: 1}),
    compact: true,
    onOpen: () => {},
  },
};
