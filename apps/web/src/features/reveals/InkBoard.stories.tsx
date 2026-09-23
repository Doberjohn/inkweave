import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {InkBoard} from './InkBoard';
import type {InkProgress} from './useRevealProgress';
import {INK_BASE} from '../../shared/constants';

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

// Season-independent art (stories.md #512): preview AVIFs are deleted when a set
// graduates, so a story pointed at them rots every season.
const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';

function progress(ink: Ink, count: number, rarityCounts: Record<string, number>): InkProgress {
  const cards = Array.from(
    {length: count},
    (_, i) =>
      ({
        id: `${ink}-${i}`,
        name: 'Card',
        fullName: `Card ${i + 1}`,
        cost: (i % 9) + 1,
        ink,
        inkwell: true,
        type: 'Character',
        imageUrl: SAMPLE_IMG,
        setCode: '9',
        // The season's real INK_BASE (not a private copy that can drift), so mock
        // setNumbers land in-range and the cards place on the board.
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
