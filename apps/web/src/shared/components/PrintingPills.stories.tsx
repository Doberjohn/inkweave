import {useState} from 'react';
import type {Meta, StoryObj} from '@storybook/react-vite';
import type {VariantRarity} from 'inkweave-synergy-engine';
import {PrintingPills} from './PrintingPills';

const meta: Meta<typeof PrintingPills> = {
  title: 'Shared/PrintingPills',
  component: PrintingPills,
  parameters: {layout: 'centered'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

/** Standard first, then the given variants, shaped like usePrintingSelection's printings. */
function Demo({variants, isMobile}: {variants: VariantRarity[]; isMobile?: boolean}) {
  const [index, setIndex] = useState(0);
  const printings = [
    {key: 'standard', label: 'Standard'},
    ...variants.map((rarity) => ({key: rarity, label: rarity, rarity})),
  ];
  return (
    <PrintingPills printings={printings} index={index} onSelect={setIndex} isMobile={isMobile} />
  );
}

// The printing switcher under a card with an alternate printing (#625), each variant marked
// with its rarity symbol. Click a pill, or focus one and use the arrow keys: they move the
// selection and wrap at the ends.
export const StandardAndIconic: Story = {
  render: () => <Demo variants={['Iconic']} />,
};

export const StandardAndEnchanted: Story = {
  render: () => <Demo variants={['Enchanted']} />,
};

// Larger tap targets for touch layouts.
export const Mobile: Story = {
  render: () => <Demo variants={['Epic']} isMobile />,
  globals: {viewport: {value: 'mobile1'}},
};

// No card has had more than one alternate printing yet. If one does, three or more pills
// switch to a compact size and show each variant by its symbol alone (named on hover and for
// screen readers), so the row still fits a 360px phone and the desktop card column.
export const FourPrintings: Story = {
  render: () => <Demo variants={['Enchanted', 'Epic', 'Iconic']} />,
};

export const FourPrintingsMobile: Story = {
  render: () => <Demo variants={['Enchanted', 'Epic', 'Iconic']} isMobile />,
  globals: {viewport: {value: 'mobile1'}},
};
