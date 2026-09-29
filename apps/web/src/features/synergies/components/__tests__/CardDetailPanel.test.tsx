import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {createCard} from '../../../../shared/test-utils';
import {trackEvent} from '../../../../shared/lib/analytics';
import {CardDetailPanel} from '../CardDetailPanel';

vi.mock('../../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

const pongo = createCard({
  id: '1938',
  name: 'Pongo',
  fullName: 'Pongo - Determined Father',
  imageUrl: '/card-images/1938.avif',
  variants: [{id: '2141', rarity: 'Enchanted', number: 223, imageUrl: '/card-images/2141.avif'}],
});
const gosalyn = createCard({
  id: '2716',
  fullName: 'Gosalyn Mallard - The Quiverwing Quack',
  imageUrl: '/card-images/2716.avif',
});

function renderPanel(card = pongo) {
  return render(
    <MemoryRouter>
      <CardDetailPanel card={card} />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  vi.mocked(trackEvent).mockClear();
});

describe('CardDetailPanel printings', () => {
  it('keeps a card without an alternate printing exactly as before: one image, no switcher', () => {
    renderPanel(gosalyn);

    expect(screen.getByRole('button', {name: 'Enlarge card image'})).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', {name: 'Card printing'})).not.toBeInTheDocument();
  });

  it('offers a Standard | Enchanted switcher for a card with an Enchanted printing', () => {
    renderPanel();

    const pills = screen.getByRole('radiogroup', {name: 'Card printing'});
    expect(
      within(pills)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Standard', 'Enchanted']);
  });

  it('opens the lightbox on the printing shown', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));
    fireEvent.click(screen.getByRole('button', {name: 'Enlarge Enchanted printing'}));

    const lightbox = screen.getByRole('dialog', {
      name: 'Enlarged view of Pongo - Determined Father, Enchanted printing',
    });
    expect(within(lightbox).getByRole('img')).toHaveAttribute('src', '/card-images/2141.avif');
  });

  it('records which alternate printing was viewed', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));

    expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
      cardId: '1938',
      rarity: 'Enchanted',
      surface: 'card_page',
    });
  });
});
