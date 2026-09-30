import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {createCard, restStrip, swipeStrip} from '../../../../shared/test-utils';
import {trackEvent} from '../../../../shared/lib/analytics';
import {CardDetail} from '../CardDetail';

vi.mock('../../../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));

const pongo = createCard({
  id: '1938',
  fullName: 'Pongo - Determined Father',
  imageUrl: '/card-images/1938.avif',
  textSections: ['TWILIGHT BARK Once during your turn, you may pay 2 to reveal the top card.'],
  variants: [{id: '2141', rarity: 'Enchanted', number: 223, imageUrl: '/card-images/2141.avif'}],
});
const gosalyn = createCard({id: '2716', fullName: 'Gosalyn Mallard - The Quiverwing Quack'});

beforeEach(() => {
  Element.prototype.scrollTo = vi.fn();
  vi.mocked(trackEvent).mockClear();
});

/** True when `a` comes before `b` in document order. */
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe('CardDetail (mobile card page)', () => {
  it('reads top to bottom like the card modal: name, details, card, printings, then text', () => {
    render(<CardDetail card={pongo} onClear={() => {}} headingLevel="h1" />);

    const name = screen.getByRole('heading', {level: 1, name: 'Pongo - Determined Father'});
    const cost = screen.getByText('Cost 3');
    const art = screen.getByRole('img', {name: 'Pongo - Determined Father'});
    const pills = screen.getByRole('radiogroup', {name: 'Card printing'});
    const text = screen.getByText(/TWILIGHT BARK/);

    expect(precedes(name, cost)).toBe(true);
    expect(precedes(cost, art)).toBe(true);
    expect(precedes(art, pills)).toBe(true);
    expect(precedes(pills, text)).toBe(true);
  });

  it('shows a card without an alternate printing with no switcher', () => {
    render(<CardDetail card={gosalyn} onClear={() => {}} />);

    expect(screen.getByRole('img', {name: gosalyn.fullName})).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', {name: 'Card printing'})).not.toBeInTheDocument();
  });

  it('offers the Standard | Enchanted switcher under the card', () => {
    render(<CardDetail card={pongo} onClear={() => {}} />);

    const pills = screen.getByRole('radiogroup', {name: 'Card printing'});
    expect(
      within(pills)
        .getAllByRole('radio')
        .map((r) => r.textContent),
    ).toEqual(['Standard', 'Enchanted']);
  });

  it('shows the printing picked and records it', () => {
    render(<CardDetail card={pongo} onClear={() => {}} />);

    fireEvent.click(screen.getByRole('radio', {name: 'Enchanted'}));

    expect(screen.getByRole('radio', {name: 'Enchanted'})).toHaveAttribute('aria-checked', 'true');
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
      cardId: '1938',
      rarity: 'Enchanted',
      surface: 'card_page',
    });
  });

  it('records a swiped printing once it comes to rest, not as the swipe crosses it', () => {
    render(<CardDetail card={pongo} onClear={() => {}} />);
    const strip = screen.getByRole('group', {name: 'Pongo - Determined Father printings'});

    swipeStrip(strip, 1);
    expect(trackEvent).not.toHaveBeenCalled();

    restStrip(strip);
    expect(trackEvent).toHaveBeenCalledTimes(1);
  });

  it('closes from its × button, as the modal does', () => {
    const onClear = vi.fn();
    render(<CardDetail card={gosalyn} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(onClear).toHaveBeenCalledOnce();
  });
});
