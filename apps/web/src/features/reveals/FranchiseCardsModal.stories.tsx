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

const IMG_IDS = [3045, 3046, 3050, 3053, 3054, 3059, 3064, 3066, 3073, 3074, 3079];

const cards: LorcanaCard[] = IMG_IDS.map(
  (id, i) =>
    ({
      id: String(id),
      name: 'Card',
      fullName: `Monsters Card ${id}`,
      cost: (i % 9) + 1,
      ink: 'Emerald',
      inkwell: true,
      type: 'Character',
      imageUrl: `/card-images-preview/${id}.avif`,
      setCode: '13',
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
    source: FRANCHISES[2],
    cards: [],
    onClose: () => {},
    onCardClick: () => {},
  },
};
