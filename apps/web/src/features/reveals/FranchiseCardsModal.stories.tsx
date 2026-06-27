import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {FranchiseCardsModal} from './FranchiseCardsModal';
import {FRANCHISES} from './franchise';

const meta: Meta<typeof FranchiseCardsModal> = {
  title: 'Features/Reveals/FranchiseCardsModal',
  component: FranchiseCardsModal,
  parameters: {backgrounds: {default: 'dark'}, layout: 'fullscreen'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

const IMG_IDS = [13074, 13075, 13079, 13082, 13083, 13088, 13093, 13095, 13102, 13103, 13108];

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
    franchise: FRANCHISES[0],
    cards,
    onClose: () => {},
    onCardClick: () => {},
  },
};

export const Empty: Story = {
  args: {
    franchise: FRANCHISES[2],
    cards: [],
    onClose: () => {},
    onCardClick: () => {},
  },
};
