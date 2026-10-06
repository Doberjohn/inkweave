import type {Meta, StoryObj} from '@storybook/react-vite';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTranslationPanel} from '../../../shared/components';
import {RADIUS, SPACING} from '../../../shared/constants';
import {MobileArtControls, ModalCardArt} from './ModalCardArt';
import {
  CardPrintingContext,
  CardTranslationContext,
  useCardTranslation,
  useModalPrinting,
} from './modalArtState';

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

// Baymax - Lab Assistant (#681): an English card whose Epic is known only from an Italian scan.
const baymax = {
  id: '14085',
  name: 'Baymax',
  fullName: 'Baymax - Lab Assistant',
  version: 'Lab Assistant',
  ink: 'Emerald',
  type: 'Character',
  cost: 4,
  inkwell: true,
  setCode: '14',
  textSections: [
    'RESUPPLY When you play this character, if you have 2 or more items in play, get 2 ink drops. (Each ink drop may be removed to pay 1 ⬡.)',
  ],
  imageUrl: '/card-images-preview/14085.avif',
  variants: [
    {
      id: '14213',
      rarity: 'Epic',
      number: 213,
      imageUrl: '/card-images-preview/14213.avif',
      scanLanguage: 'it',
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

/**
 * The printings strip with the mobile controls under it, wired through the modal's real state
 * hooks: the printing shown, and the translation that follows it (#681).
 */
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
  const translation = useCardTranslation(card, true, printing);
  return (
    <CardTranslationContext.Provider value={translation}>
      <CardPrintingContext.Provider value={printing}>
        <div
          style={{display: 'flex', flexDirection: 'column', alignItems: 'center', gap: SPACING.md}}>
          <div style={{position: 'relative'}}>
            <ModalCardArt card={card} cardWidth={cardWidth} cardHeight={cardHeight} />
            {translation?.shown && (
              <CardTranslationPanel
                card={card}
                language={translation.language}
                size="compact"
                style={{position: 'absolute', inset: 0, borderRadius: RADIUS.xl}}
              />
            )}
          </div>
          <MobileArtControls />
        </div>
      </CardPrintingContext.Provider>
    </CardTranslationContext.Provider>
  );
}

/** Swipe the art or pick a pill: both move together (#625). */
export const Printings: Story = {
  render: (args) => <WithPrintings {...args} />,
};

/** Pick the Epic, an Italian scan, and "See translation" lays the card's English text over it. */
export const ForeignScanVariant: Story = {
  args: {card: baymax},
  render: (args) => <WithPrintings {...args} />,
};
