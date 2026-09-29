import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardOverviewModalFallback} from '../CardOverviewModalFallback';

const card = {id: '1939', fullName: 'Woody - Jungle Guide'} as LorcanaCard;
const cardWithPrintings = {
  ...card,
  variants: [{id: '14241', rarity: 'Iconic', number: 241}],
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

  it('closes on Escape', () => {
    const onClose = vi.fn();
    render(<CardOverviewModalFallback card={card} isMobile onClose={onClose} />);

    fireEvent.keyDown(document, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledOnce();
  });

  it.each([false, true])(
    'holds the space for the printing pills out of sight, so the modal adds them without a shift (mobile: %s)',
    (isMobile) => {
      const {container} = render(
        <CardOverviewModalFallback card={cardWithPrintings} isMobile={isMobile} onClose={vi.fn()} />,
      );

      expect(container.querySelector('[role="radiogroup"]')).not.toBeNull();
      expect(screen.queryByRole('radiogroup')).toBeNull();
    },
  );

  it('reserves no printing space for a card with a single printing', () => {
    const {container} = render(<CardOverviewModalFallback card={card} isMobile={false} onClose={vi.fn()} />);

    expect(container.querySelector('[role="radiogroup"]')).toBeNull();
  });

  it('holds the space for the translation toggle out of sight for a foreign-language scan', () => {
    const {container} = render(
      <CardOverviewModalFallback card={{...card, scanLanguage: 'ja'} as LorcanaCard} isMobile onClose={vi.fn()} />,
    );

    expect(container.querySelector('button')).not.toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('leaves focus on the tile that opened it, for the modal to restore later', () => {
    render(<button type="button">card tile</button>);
    const tile = screen.getByRole('button', {name: 'card tile'});
    tile.focus();

    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(tile);
  });
});
