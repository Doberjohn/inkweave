import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkBoard} from './InkBoard';
import type {InkProgress} from './useRevealProgress';

const meta: Meta<typeof InkBoard> = {
  title: 'Features/Reveals/InkBoard',
  component: InkBoard,
  parameters: {backgrounds: {default: 'dark'}, layout: 'padded'},
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
  13002, 13005, 13006, 13007, 13009, 13017, 13021, 13024, 13026, 13028, 13029, 13030, 13031, 13033,
  13034, 13037, 13038, 13040, 13044, 13049, 13051, 13052, 13058, 13059, 13060, 13061, 13065, 13067,
  13068, 13074, 13075, 13079, 13082, 13083,
];

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
        setNumber: i + 1,
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
