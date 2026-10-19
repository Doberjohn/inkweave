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

  it('holds the space for the printing pills out of sight on mobile, so the modal adds them without a shift', () => {
    const {container} = render(<CardOverviewModalFallback card={cardWithPrintings} isMobile onClose={vi.fn()} />);

    expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
    expect(screen.queryByRole('radiogroup')).toBeNull();
  });

  // Desktop's controls sit in a row pinned under the shrunk art, so the placeholder shrinks alike.
  it('shrinks the card placeholder on desktop for a card with art controls, and only then', () => {
    const placeholder = (c: LorcanaCard) => {
      const {container, unmount} = render(<CardOverviewModalFallback card={c} isMobile={false} onClose={vi.fn()} />);
      const transform = container.querySelector<HTMLElement>('.react-loading-skeleton')!.style.transform;
      unmount();
      return transform;
    };

    expect(placeholder(cardWithPrintings)).toMatch(/^scale\(0\.\d+\)$/);
    expect(placeholder(card)).toBe('');
    // A foreign scan's toggle sits in the header (owner, 2026-10-17), so it shrinks no art.
    expect(placeholder({...card, scanLanguage: 'ja'} as LorcanaCard)).toBe('');
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
});
