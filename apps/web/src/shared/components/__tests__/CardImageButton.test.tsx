import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardImageButton} from '../CardImageButton';

describe('CardImageButton', () => {
  it('is a button named for what it enlarges, wrapping the art', () => {
    render(
      <CardImageButton ariaLabel="Enlarge card image" onClick={() => {}}>
        <img alt="Pongo - Determined Father" />
      </CardImageButton>,
    );

    const button = screen.getByRole('button', {name: 'Enlarge card image'});
    expect(button).toContainElement(screen.getByAltText('Pongo - Determined Father'));
  });

  it('enlarges on click', () => {
    const onClick = vi.fn();
    render(
      <CardImageButton ariaLabel="Enlarge card image" onClick={onClick}>
        <span />
      </CardImageButton>,
    );

    fireEvent.click(screen.getByRole('button', {name: 'Enlarge card image'}));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it('is a Tab stop of its own, drawn bare, unless a roving Tab order places it or it sits among tiles', () => {
    render(
      <>
        <CardImageButton ariaLabel="Enlarge card image" onClick={() => {}}>
          <span />
        </CardImageButton>
        <CardImageButton
          ariaLabel="Hades - Dark Usurper, 29/C3 printing"
          onClick={() => {}}
          tabIndex={-1}
          tile>
          <span />
        </CardImageButton>
      </>,
    );

    const bare = screen.getByRole('button', {name: 'Enlarge card image'});
    expect(bare).not.toHaveAttribute('data-roving-item');
    expect(bare).not.toHaveClass('card-tile');
    const pocket = screen.getByRole('button', {name: 'Hades - Dark Usurper, 29/C3 printing'});
    expect(pocket).toHaveAttribute('data-roving-item');
    expect(pocket).toHaveAttribute('tabindex', '-1');
    expect(pocket).toHaveClass('card-tile');
  });
});
