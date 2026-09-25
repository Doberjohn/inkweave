import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {FranchiseCardsModal} from './FranchiseCardsModal';
import {FRANCHISES} from './franchise';

const meta: Meta<typeof FranchiseCardsModal> = {
  title: 'Features/Reveals/FranchiseCardsModal',
  component: FranchiseCardsModal,
  parameters: {layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Season-independent art (stories.md #512): preview AVIFs are deleted when a set
// graduates, so a story pointed at them rots every season.
const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';

const cards: LorcanaCard[] = Array.from(
  {length: 11},
  (_, i) =>
    ({
      id: String(i + 1),
      name: 'Card',
      fullName: `Showcase Card ${i + 1}`,
      cost: (i % 9) + 1,
      ink: 'Emerald',
      inkwell: true,
      type: 'Character',
      imageUrl: SAMPLE_IMG,
      setCode: '9',
      setNumber: i + 1,
    }) as LorcanaCard,
);

export const Default: Story = {
  args: {
    source: FRANCHISES[0],
    cards,
    onClose: () => {},
    onCardClick: () => {},
  },
};

export const Empty: Story = {
  args: {
    source: FRANCHISES[0],
    cards: [],
    onClose: () => {},
    onCardClick: () => {},
  },
};
