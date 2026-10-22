import type {CSSProperties} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import {PrintingName, type NamedPrinting} from './PrintingName';
import {COLORS, FONTS, FONT_SIZES, SPACING} from '../constants';
import {printingName, type Printing} from '../hooks/usePrintingSelection';

const meta: Meta<typeof PrintingName> = {
  title: 'Shared/PrintingName',
  component: PrintingName,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** The facts a printing is named from, as a card's `variants` entry carries them. */
type VariantFacts = Pick<Printing, 'number' | 'promoGrouping' | 'finish' | 'artVariant' | 'printedName'> & {
  rarity: string;
};

/** A variant shaped like usePrintingSelection's printings, named by the same `printingName`. */
function named(key: string, facts: VariantFacts): NamedPrinting {
  return {...facts, key, label: printingName(facts)};
}

/** The row each name sits in, laid out as the peek's and the turn's notice lay it out. */
const ROW_STYLE: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: SPACING.xs,
  color: COLORS.text,
  fontFamily: FONTS.body,
  fontSize: FONT_SIZES.md,
  fontWeight: 600,
};

function Names({printings}: {printings: NamedPrinting[]}) {
  return (
    <div style={{display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
      {printings.map((printing) => (
        <div key={printing.key} style={ROW_STYLE}>
          <PrintingName printing={printing} />
        </div>
      ))}
    </div>
  );
}

// What the printings' peek and a turn's notice call each printing (#802): Standard plain, and the
// chase rarities by their symbol and name.
export const Rarities: Story = {
  render: () => (
    <Names
      printings={[
        {key: 'standard', label: 'Standard'},
        named('2142', {rarity: 'Enchanted', number: 224}),
        named('2166', {rarity: 'Epic', number: 212}),
        named('14241', {rarity: 'Iconic', number: 241}),
      ]}
    />
  ),
};

// Mr. Incredible - Super Strong's printing that keeps his Legendary rarity: an alt foil, with the
// gold foil marker.
export const AltFoil: Story = {
  render: () => <Names printings={[named('3571', {rarity: 'Legendary', number: 243})]} />,
};

// Promos by the code printed on each: Mickey Mouse - True Friend's four, a twin's finish, a
// two-art promo's letter, and a promo printed under another name (#891).
export const Promos: Story = {
  render: () => (
    <Names
      printings={[
        named('80042', {rarity: 'Special', number: 25, promoGrouping: 'P1'}),
        named('80044', {rarity: 'Special', number: 15, promoGrouping: 'P2'}),
        named('80010', {rarity: 'Special', number: 8, promoGrouping: 'C1', finish: 'foil'}),
        named('1661', {rarity: 'Special', number: 24, promoGrouping: 'P2', artVariant: 'A'}),
        named('1663', {rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana'}),
      ]}
    />
  ),
};
