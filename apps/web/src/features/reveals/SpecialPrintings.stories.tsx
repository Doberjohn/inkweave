import type {Meta, StoryObj} from '@storybook/react-vite';
import type {Ink, LorcanaCard} from 'inkweave-synergy-engine';
import {SpecialPrintings} from './SpecialPrintings';
import type {SpecialSlot} from './useRevealProgress';
import {specialSlotsFor} from '../../shared/constants';

const meta: Meta<typeof SpecialPrintings> = {
  title: 'Features/Reveals/SpecialPrintings',
  component: SpecialPrintings,
  parameters: {layout: 'padded'},
  tags: ['autodocs'],
};
export default meta;
type Story = StoryObj<typeof meta>;

// Season-independent art (stories.md #512): preview AVIFs are deleted when a set graduates.
const SAMPLE_IMG = '/card-images/en/set6/35_b9afe49519236b60d7d6eca0359905ef44cecae9.jpg';

/** An ink's special printing lineup with the given collector numbers revealed. */
function lineup(ink: Ink, revealed: number[]): SpecialSlot[] {
  const card = {
    id: `${ink}-base`,
    name: 'Card',
    fullName: 'Sample Card',
    ink,
    type: 'Character',
    cost: 3,
    inkwell: true,
    imageUrl: SAMPLE_IMG,
    setCode: '9',
  } as LorcanaCard;
  return specialSlotsFor(ink).map((spec) =>
    revealed.includes(spec.number)
      ? {...spec, card, printing: {id: `${ink}-${spec.number}`, rarity: spec.rarity, number: spec.number, imageUrl: SAMPLE_IMG}}
      : {...spec},
  );
}

/** Amber: two Enchanteds and the Iconic revealed, no Epic yet. */
export const Partial: Story = {
  args: {ink: 'Amber', slots: lineup('Amber', [223, 224, 241]), onOpenPrinting: () => {}},
};

export const NoneRevealed: Story = {
  args: {ink: 'Amethyst', slots: lineup('Amethyst', [])},
};

/** A highlighted rarity dims every other slot, revealed or not. */
export const RarityHighlighted: Story = {
  args: {ink: 'Amber', slots: lineup('Amber', [223, 224, 241]), selectedRarity: 'enchanted', onOpenPrinting: () => {}},
};

/** Phones stack the Epics above the Enchanteds and the Iconic. */
export const Mobile: Story = {
  args: {ink: 'Sapphire', slots: lineup('Sapphire', [235, 242]), compact: true, onOpenPrinting: () => {}},
  globals: {viewport: {value: 'mobile1'}},
};
