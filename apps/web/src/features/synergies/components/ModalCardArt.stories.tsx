import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SPACING} from '../../../shared/constants';
import {MobileArtControls, ModalCardArt} from './ModalCardArt';
import {CardPrintingContext, useModalPrinting} from './modalArtState';

// Pongo - Determined Father, a Core card with an Enchanted printing (#625), on self-hosted art.
const pongo = {
  id: '1938',
  name: 'Pongo',
  fullName: 'Pongo - Determined Father',
  version: 'Determined Father',
  ink: 'Amber',
  type: 'Character',
  cost: 3,
  inkwell: true,
  setCode: '9',
  textSections: [],
  imageUrl: '/card-images/1938.38360237d5667c5b.avif',
  variants: [
    {
      id: '2141',
      rarity: 'Enchanted',
      number: 223,
      imageUrl: '/card-images/2141.0171ffc9fc41ec5d.avif',
    },
  ],
} as unknown as LorcanaCard;

const meta = {
  title: 'Synergies/ModalCardArt',
  component: ModalCardArt,
  parameters: {layout: 'centered'},
  args: {card: pongo, cardWidth: 240, cardHeight: 335},
} satisfies Meta<typeof ModalCardArt>;
export default meta;
type Story = StoryObj<typeof meta>;

/** Without printing state (the modal gives none to a card with a single printing): the scan. */
export const Scan: Story = {};

/** The printings strip with the mobile pills under it, wired through the modal's real state hook. */
function WithPrintings({
  card,
  cardWidth,
  cardHeight,
}: {
  card: LorcanaCard;
  cardWidth: number;
  cardHeight: number;
}) {
  const printing = useModalPrinting(card, {isOpen: true, inComparison: false});
  return (
    <CardPrintingContext.Provider value={printing}>
      <div
        style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
        <ModalCardArt card={card} cardWidth={cardWidth} cardHeight={cardHeight} />
        <MobileArtControls />
      </div>
    </CardPrintingContext.Provider>
  );
}

/** Swipe the art or pick a pill: both move together (#625). */
export const Printings: Story = {
  render: (args) => <WithPrintings {...args} />,
};
