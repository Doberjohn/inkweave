import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardOverviewModalFallback} from '../CardOverviewModalFallback';

const card = {id: '1939', fullName: 'Woody - Jungle Guide'} as LorcanaCard;

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

  it('leaves focus on the tile that opened it, for the modal to restore later', () => {
    render(<button type="button">card tile</button>);
    const tile = screen.getByRole('button', {name: 'card tile'});
    tile.focus();

    render(<CardOverviewModalFallback card={card} isMobile={false} onClose={vi.fn()} />);
    expect(document.activeElement).toBe(tile);
  });
});
