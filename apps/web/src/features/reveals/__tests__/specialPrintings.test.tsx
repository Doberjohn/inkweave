import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SpecialPrintings} from '../SpecialPrintings';
import type {SpecialSlot} from '../useRevealProgress';
import {specialSlotsFor} from '../../../shared/constants';

const card = {id: '14019', fullName: 'Aurora - Delightful Musician', ink: 'Amber'} as LorcanaCard;
const printing = {id: '14223', rarity: 'Enchanted' as const, number: 223, imageUrl: '/card-images-preview/14223.avif'};
const slots: SpecialSlot[] = specialSlotsFor('Amber').map((spec) =>
  spec.number === printing.number ? {...spec, card, printing} : {...spec},
);

describe('SpecialPrintings', () => {
  it('counts the revealed printings against the ink lineup', () => {
    render(<SpecialPrintings ink="Amber" slots={slots} />);
    expect(screen.getByRole('group', {name: 'Alt arts'})).toHaveTextContent('1 / 7');
  });

  it('opens a revealed printing with its base card', () => {
    const onOpenPrinting = vi.fn();
    render(<SpecialPrintings ink="Amber" slots={slots} onOpenPrinting={onOpenPrinting} />);
    fireEvent.click(screen.getByRole('button', {name: 'View Aurora - Delightful Musician, Enchanted alt art'}));
    expect(onOpenPrinting).toHaveBeenCalledWith(card, printing);
  });

  it('leaves the unrevealed printings unclickable', () => {
    render(<SpecialPrintings ink="Amber" slots={slots} onOpenPrinting={vi.fn()} />);
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('shows a printing numbered outside the lineup inside its rarity group', () => {
    const stray: SpecialSlot = {number: 299, rarity: 'Enchanted', card, printing: {...printing, id: '14299', number: 299}};
    render(<SpecialPrintings ink="Amber" slots={[...slots, stray]} />);
    expect(screen.getAllByText('Enchanted')).toHaveLength(1);
    expect(screen.getByRole('group', {name: 'Alt arts'})).toHaveTextContent('2 / 8');
  });
});
