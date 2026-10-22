import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {createCard, swipeCard} from '../../../../shared/test-utils';
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
  it('reads top to bottom like the card modal: name, details, the card with its printings, then text', () => {
    render(<CardDetail card={pongo} onClear={() => {}} headingLevel="h1" />);

    const name = screen.getByRole('heading', {level: 1, name: 'Pongo - Determined Father'});
    const cost = screen.getByText('Cost 3');
    const printings = screen.getByRole('group', {name: 'Pongo - Determined Father printings'});
    const text = screen.getByText(/TWILIGHT BARK/);

    expect(precedes(name, cost)).toBe(true);
    expect(precedes(cost, printings)).toBe(true);
    expect(precedes(printings, text)).toBe(true);
  });

  it('shows a card without an alternate printing as its image alone', () => {
    render(<CardDetail card={gosalyn} onClear={() => {}} />);

    expect(screen.getByRole('img', {name: gosalyn.fullName})).toBeInTheDocument();
    expect(screen.queryByRole('group', {name: /printings$/})).not.toBeInTheDocument();
  });

  // The pills under the card went (owner, 2026-10-22): the printing beside it is the way there.
  it('turns to the printing beside the card and records it', () => {
    render(<CardDetail card={pongo} onClear={() => {}} />);

    fireEvent.click(screen.getByRole('button', {name: 'Next printing: Enchanted'}));

    expect(screen.getByRole('img', {name: 'Pongo - Determined Father, Enchanted printing'})).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('card_printing_view', {
      cardId: '1938',
      printingId: '2141',
      rarity: 'Enchanted',
      surface: 'card_page',
    });
  });

  it('records the printing a swipe throws the card to, once', () => {
    render(<CardDetail card={pongo} onClear={() => {}} />);

    swipeCard(screen.getByRole('group', {name: 'Pongo - Determined Father printings'}));

    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('card_printing_view', expect.objectContaining({printingId: '2141'}));
  });

  it('closes from its × button, as the modal does', () => {
    const onClear = vi.fn();
    render(<CardDetail card={gosalyn} onClear={onClear} />);

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));

    expect(onClear).toHaveBeenCalledOnce();
  });
});
