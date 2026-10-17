import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {PrintingPills} from './PrintingPills';
import {printingName, type Printing} from '../hooks/usePrintingSelection';

const meta: Meta<typeof PrintingPills> = {
  title: 'Shared/PrintingPills',
  component: PrintingPills,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The facts a printing is named from, as a card's `variants` entry carries them. */
type VariantFacts = Pick<Printing, 'number' | 'promoGrouping' | 'finish'> & {rarity: string};

/** The desktop card column the switcher sits in (CardDetailPanel), where its chips wrap. */
const CARD_COLUMN_WIDTH = 298;

/**
 * Standard first, then the given variants, shaped like usePrintingSelection's printings and named
 * by the same `printingName`, inside the card column so wrapping shows as it does on the page.
 */
function Demo({variants, isMobile}: {variants: VariantFacts[]; isMobile?: boolean}) {
  const [index, setIndex] = useState(0);
  const printings = [
    {key: 'standard', label: 'Standard'},
    ...variants.map((v, i) => ({...v, key: String(i), label: printingName(v)})),
  ];
  return (
    <div style={{width: isMobile ? undefined : CARD_COLUMN_WIDTH}}>
      <PrintingPills printings={printings} index={index} onSelect={setIndex} isMobile={isMobile} />
    </div>
  );
}

// The printing switcher under a card with an alternate printing (#625): every chip says what the
// printing is and where it's from (#802). Click a chip, or focus one and use the arrow keys: they
// move the selection and wrap at the ends.
export const StandardAndIconic: Story = {
  render: () => <Demo variants={[{rarity: 'Iconic', number: 241}]} />,
};

export const StandardAndEnchanted: Story = {
  render: () => <Demo variants={[{rarity: 'Enchanted', number: 223}]} />,
};

// Larger tap targets for touch layouts.
export const Mobile: Story = {
  render: () => <Demo variants={[{rarity: 'Epic', number: 212}]} isMobile />,
  globals: {viewport: {value: 'mobile1'}},
};

// Mr. Incredible - Super Strong: Enchanted, and a printing that keeps his Legendary rarity, an
// alt foil with the gold foil marker. The three share one line of the card column.
export const MrIncredible: Story = {
  render: () => (
    <Demo
      variants={[
        {rarity: 'Enchanted', number: 234},
        {rarity: 'Legendary', number: 243},
      ]}
    />
  ),
};

// Mickey Mouse - True Friend's four promos, the most printings any card gets: the promo symbol and
// the code printed on each, wrapping to a second line.
export const MickeyPromos: Story = {
  render: () => (
    <Demo
      variants={[
        {rarity: 'Special', number: 25, promoGrouping: 'P1'},
        {rarity: 'Special', number: 15, promoGrouping: 'P2'},
        {rarity: 'Special', number: 36, promoGrouping: 'P2'},
        {rarity: 'Special', number: 10, promoGrouping: 'P3'},
      ]}
    />
  ),
};

// Kuzco - Temperamental Emperor's two 8/C1 promos share a code: only their finish tells them apart.
export const KuzcoTwins: Story = {
  render: () => (
    <Demo
      variants={[
        {rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'foil'},
        {rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'normal'},
      ]}
    />
  ),
};

// Every kind of chip at once on a phone, where the larger tap targets wrap sooner.
export const AllKindsMobile: Story = {
  render: () => (
    <Demo
      variants={[
        {rarity: 'Epic', number: 212},
        {rarity: 'Common', number: 243},
        {rarity: 'Special', number: 1, promoGrouping: 'C2'},
        {rarity: 'Special', number: 5, promoGrouping: 'C2'},
      ]}
      isMobile
    />
  ),
  globals: {viewport: {value: 'mobile1'}},
};
