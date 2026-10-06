import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {createCard, restStrip, swipeStrip} from '../../../../shared/test-utils';
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
// An English card whose Epic is known only from an Italian scan (#681).
const baymax = createCard({
  id: '14085',
  fullName: 'Baymax - Lab Assistant',
  imageUrl: '/card-images/14085.avif',
  variants: [
    {
      id: '14213',
      rarity: 'Epic',
      number: 213,
      imageUrl: '/card-images/14213.avif',
      scanLanguage: 'it',
    },
  ],
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

  it('offers a translation in the lightbox of a variant revealed in another language', () => {
    renderPanel(baymax);

    fireEvent.click(screen.getByRole('radio', {name: 'Epic'}));
    fireEvent.click(screen.getByRole('button', {name: 'Enlarge Epic printing'}));
    fireEvent.click(screen.getByRole('button', {name: 'See translation'}));

    expect(screen.getByTestId('card-translation')).toHaveTextContent(
      'This printing is in Italian.',
    );
  });

  it("offers no translation in the lightbox of a foreign card's English variant", () => {
    renderPanel({...pongo, scanLanguage: 'ja'});

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));
    fireEvent.click(screen.getByRole('button', {name: 'Enlarge Enchanted printing'}));

    expect(screen.queryByRole('button', {name: 'See translation'})).not.toBeInTheDocument();
  });

  it('closes the lightbox when the page moves on to another card', () => {
    const {rerender} = renderPanel(gosalyn);
    fireEvent.click(screen.getByRole('button', {name: 'Enlarge card image'}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();

    // The card page stays mounted across /card/:id navigations, a browser Back for one.
    const showCard = (card: typeof pongo) =>
      rerender(
        <MemoryRouter>
          <CardDetailPanel card={card} />
        </MemoryRouter>,
      );
    showCard(pongo);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // Nor does it reopen when the first card comes back.
    showCard(gosalyn);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('records which alternate printing was viewed', () => {
    renderPanel();

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));

    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
      cardId: '1938',
      rarity: 'Enchanted',
      surface: 'card_page',
    });
  });

  it('records a swiped printing once it comes to rest, not as the swipe crosses it', () => {
    renderPanel();
    const strip = screen.getByRole('group', {name: 'Pongo - Determined Father printings'});

    swipeStrip(strip, 1);
    expect(trackEvent).not.toHaveBeenCalled();

    restStrip(strip);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });
});
