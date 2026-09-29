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
});
