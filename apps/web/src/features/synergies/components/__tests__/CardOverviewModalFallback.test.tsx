import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardOverviewModalFallback} from '../CardOverviewModalFallback';

const card = {id: '1939', fullName: 'Woody - Jungle Guide'} as LorcanaCard;
const cardWithPrintings = {
  ...card,
  variants: [{id: '14241', rarity: 'Iconic', number: 241}],
} as LorcanaCard;
// #681: a variant can be revealed abroad before its English printing.
const cardWithForeignVariant = {
  ...card,
  variants: [{id: '14213', rarity: 'Epic', number: 213, scanLanguage: 'it'}],
} as LorcanaCard;

describe('CardOverviewModalFallback', () => {
  it('announces the card it is loading', () => {
    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={vi.fn()} />);

    expect(screen.getByRole('status', {name: 'Loading Woody - Jungle Guide'})).toBeInTheDocument();
    expect(screen.getByText('Woody - Jungle Guide')).toBeInTheDocument();
  });

  it("reads the number of the printing the open names, as the modal's title will", () => {
    const numbered = {...cardWithPrintings, setCode: '9', setNumber: 52} as LorcanaCard;
    render(<CardOverviewModalFallback card={numbered} isMobile={false} printingId="14241" onClose={vi.fn()} />);

    expect(screen.getByText('241/204')).toBeInTheDocument();
  });

  it('closes on a scrim click, like the modal', () => {
    const onClose = vi.fn();
    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={onClose} />);

    fireEvent.click(screen.getByTestId('card-overview-fallback-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes from its × button, which anyone can reach, like the modal', () => {
    const onClose = vi.fn();
    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CardOverviewModalFallback card={card} isMobile onClose={onClose} />);

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledOnce();
  });

  // Browse holds the row under the card for its copies (useHoldCopiesRow), so the window opens with it.
  it("holds the copies row's room under a phone's card, where the window will hold one", () => {
    const room = (copiesRow: boolean) => {
      const {container, unmount} = render(
        <CardOverviewModalFallback card={card} isMobile copiesRow={copiesRow} onClose={vi.fn()} />,
      );
      const held = container.querySelector<HTMLElement>('[style*="height: 23px"]');
      unmount();
      return held?.style.width;
    };

    expect(room(true)).toBe('240px');
    expect(room(false)).toBeUndefined();
  });

  it("keeps the card placeholder at full size on desktop, its row holding the copies row's room only where the window holds one", () => {
    const placeholder = (c: LorcanaCard, copiesRow: boolean) => {
      const {container, unmount} = render(
        <CardOverviewModalFallback card={c} isMobile={false} copiesRow={copiesRow} onClose={vi.fn()} />,
      );
      // The card's ink tile comes first, ahead of the synergy column's neutral tiles; its box is the card's.
      const art = container.querySelector<HTMLElement>('.ink-card-placeholder')!.parentElement!;
      const row = art.closest<HTMLElement>('[style*="display: grid"]')!;
      const shape = {transform: art.style.transform, height: art.style.height, row: row.style.height};
      unmount();
      return shape;
    };

    expect(placeholder(card, true)).toEqual({transform: '', height: '470px', row: '514px'});
    expect(placeholder(cardWithPrintings, false)).toEqual({transform: '', height: '470px', row: '470px'});
    // A foreign scan's toggle sits in the header (owner, 2026-10-17), so it takes no room here.
    expect(placeholder({...card, scanLanguage: 'ja'} as LorcanaCard, false)).toEqual({
      transform: '',
      height: '470px',
      row: '470px',
    });
  });

  it("holds the translation toggle's space out of sight in the header on desktop, where the modal puts it", () => {
    const foreign = {...card, scanLanguage: 'ja'} as LorcanaCard;
    render(<CardOverviewModalFallback card={foreign} isMobile={false} onClose={vi.fn()} />);
    const header = screen.getByTestId('card-overview-fallback').firstElementChild;

    expect(header).toContainElement(screen.getByText('See translation'));
    expect(screen.queryByRole('button', {name: 'See translation'})).toBeNull();
  });

  it.each([
    ['its own scan', {...card, scanLanguage: 'ja'} as LorcanaCard],
    ["a variant printing's scan", cardWithForeignVariant],
  ])(
    'holds the space for the translation toggle out of sight when %s is foreign',
    (_label, foreign) => {
      render(<CardOverviewModalFallback card={foreign} isMobile onClose={vi.fn()} />);

      expect(screen.getByText('See translation')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'See translation'})).toBeNull();
    },
  );

  it('reserves no toggle space for an English card, even one with an alternate printing', () => {
    render(<CardOverviewModalFallback card={cardWithPrintings} isMobile onClose={vi.fn()} />);

    expect(screen.queryByText('See translation')).toBeNull();
  });

  it('leaves focus on the tile that opened it, for the modal to restore later', () => {
    render(<button type="button">card tile</button>);
    const tile = screen.getByRole('button', {name: 'card tile'});
    tile.focus();

    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(tile);
  });

  // #913: a shared compare link opens on this frame before either card is known.
  it.each([false, true])('draws a card-less frame for a comparison still loading (isMobile: %s)', (isMobile) => {
    const {container} = render(<CardOverviewModalFallback isMobile={isMobile} onClose={vi.fn()} />);

    expect(screen.getByRole('status', {name: 'Loading comparison'})).toBeInTheDocument();
    expect(screen.queryByText('See translation')).toBeNull();
    // The art's tile is the neutral one: no card, so no ink.
    expect(container.querySelector('.ink-card-placeholder')).not.toBeNull();
    expect(screen.getByRole('button', {name: 'Close'})).toBeInTheDocument();
  });
});
