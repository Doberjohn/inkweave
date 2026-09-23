import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {CardMosaic} from './CardMosaic';
import {INK_BASE, PER_INK} from '../../shared/constants';

const meta: Meta<typeof CardMosaic> = {
  title: 'Features/Reveals/CardMosaic',
  component: CardMosaic,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Season-independent art (stories.md #512): preview AVIFs are deleted when a set
// graduates, so a story pointed at them rots every season.
const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';

function cards(n: number, ink: Ink = 'Amber'): LorcanaCard[] {
  return Array.from(
    {length: n},
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
        // Anchor on the ink's real base (the season's INK_BASE, not a private copy
        // that can drift) so cards fill from the first slot of the board.
        setNumber: INK_BASE[ink] + i,
      }) as LorcanaCard,
  );
}

export const Partial: Story = {
  args: {ink: 'Amber', cards: cards(20), onOpen: () => {}},
};

export const Complete: Story = {
  args: {ink: 'Emerald', cards: cards(PER_INK.Emerald, 'Emerald'), onOpen: () => {}},
};

export const Empty: Story = {
  args: {ink: 'Sapphire', cards: []},
};

export const Mobile: Story = {
  args: {ink: 'Ruby', cards: cards(20, 'Ruby'), compact: true, onOpen: () => {}},
};
