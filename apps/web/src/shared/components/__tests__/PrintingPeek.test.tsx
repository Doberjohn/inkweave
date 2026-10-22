import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {PeekButton, TurnNotice} from '../PrintingPeek';
import type {Printing} from '../../hooks';

const enchanted: Printing = {key: '2141', label: 'Enchanted', rarity: 'Enchanted'};

function renderPeek(printing: Printing, onTurn = vi.fn()) {
  render(<PeekButton side="next" printing={printing} outside={16} inside={8} onTurn={onTurn} />);
  return onTurn;
}

describe('PeekButton', () => {
  it('turns to the printing it is named for, from its edge past the card and the card\'s side', () => {
    const onTurn = renderPeek(enchanted);
    const peek = screen.getByRole('button', {name: 'Next printing: Enchanted'});

    fireEvent.click(peek);

    expect(onTurn).toHaveBeenCalledOnce();
    expect(peek).toHaveStyle({right: '-16px', width: '24px'});
  });

  // The card's box takes the pointer mid-drag, so the cursor shows the grab.
  it('lets a drag pass over it', () => {
    render(<PeekButton side="prev" printing={enchanted} outside={16} inside={8} dragging onTurn={() => {}} />);

    expect(screen.getByRole('button', {name: 'Previous printing: Enchanted'})).toHaveStyle({pointerEvents: 'none'});
  });

  // Read aloud, a code alone means little, and a card could hold two alt foils (#802).
  it("tells screen readers an alt foil's number and that a promo is one", () => {
    renderPeek({key: '3571', label: 'Alt foil', rarity: 'Legendary', number: 243});
    renderPeek({key: '1663', label: '26/P2 Vaiana', rarity: 'Special', number: 26, promoGrouping: 'P2', printedName: 'Vaiana'});

    expect(screen.getByRole('button', {name: 'Next printing: Alt foil, #243'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Next printing: Promo 26/P2, Vaiana'})).toBeInTheDocument();
  });
});

describe('TurnNotice', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const notice = (container: HTMLElement) => container.firstElementChild as HTMLElement;

  it('shows nothing until the visitor turns', () => {
    const {container} = render(<TurnNotice printing={enchanted} position={2} count={3} turns={0} />);

    expect(notice(container)).toHaveStyle({opacity: '0'});
    expect(screen.getByRole('status')).toBeEmptyDOMElement();
  });

  it('names the printing a turn brought in for a moment, and again after the next turn', () => {
    vi.useFakeTimers();
    const {container, rerender} = render(<TurnNotice printing={enchanted} position={2} count={3} turns={1} />);
    expect(notice(container)).toHaveStyle({opacity: '1'});
    expect(screen.getByRole('status')).toHaveTextContent('Enchanted, 2 of 3');

    act(() => {
      vi.advanceTimersByTime(1400);
    });
    expect(notice(container)).toHaveStyle({opacity: '0'});

    rerender(<TurnNotice printing={enchanted} position={2} count={3} turns={2} />);
    expect(notice(container)).toHaveStyle({opacity: '1'});
  });
});
