import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardTile, type TileArt} from '../CardTile';
import {createCard} from '../../test-utils/cards';

const card = createCard({
  id: '1936',
  name: 'Bruno Madrigal',
  fullName: 'Bruno Madrigal - Undetected Uncle',
  imageUrl: '/card-images/1936.avif',
});
const enchanted = {
  id: '1936-ench',
  rarity: 'Enchanted' as const,
  number: 223,
  imageUrl: '/card-images/ench.avif',
};
const named = (art: TileArt) => `/art/${art.id}.avif`;

describe('CardTile', () => {
  // As admin renders it (inkweave-admin#102): neither seam, unpressed, out of the Tab order.
  it("renders with neither seam, as a button showing the card's own art", () => {
    render(<CardTile card={card} isSelected={false} tabIndex={-1} />);

    const tile = screen.getByRole('button', {name: 'Bruno Madrigal - Undetected Uncle'});
    expect(tile).toHaveAttribute('aria-pressed', 'false');
    expect(tile).toHaveAttribute('tabindex', '-1');
    expect(tile.querySelector('img')).toHaveAttribute('src', '/card-images/1936.avif');
  });

  // React reports what a handler throws to the window, not to fireEvent's caller.
  it('takes pointer enter and focus as a link with no onIntent', () => {
    const errors: unknown[] = [];
    const record = (event: ErrorEvent) => {
      errors.push(event.error);
    };
    window.addEventListener('error', record);
    render(<CardTile card={card} href="/card/1936" />);
    const tile = screen.getByRole('link');

    fireEvent.pointerEnter(tile);
    fireEvent.focus(tile);
    window.removeEventListener('error', record);
    expect(errors).toEqual([]);
  });

  it('runs onIntent as the visitor heads for a link, on pointer enter and on focus', () => {
    const onIntent = vi.fn();
    render(<CardTile card={card} href="/card/1936" onIntent={onIntent} />);
    const tile = screen.getByRole('link');

    fireEvent.pointerEnter(tile);
    expect(onIntent).toHaveBeenCalledTimes(1);
    fireEvent.focus(tile);
    expect(onIntent).toHaveBeenCalledTimes(2);
  });

  // A button tile selects in place (the deck builder, voting), so it opens nothing to warm.
  it.each([
    ['a link', {href: '/card/1936'}],
    ['a button', {}],
  ] as const)('is described by what describedBy names, as %s', (_, as) => {
    render(
      <>
        <CardTile card={card} describedBy="badge" {...as} />
        <p id="badge">3 friends have it</p>
      </>,
    );
    expect(screen.getByLabelText('Bruno Madrigal - Undetected Uncle')).toHaveAccessibleDescription('3 friends have it');
  });

  it('never runs onIntent from a button', () => {
    const onIntent = vi.fn();
    render(<CardTile card={card} isSelected={false} onIntent={onIntent} />);
    const tile = screen.getByRole('button');

    fireEvent.pointerEnter(tile);
    fireEvent.focus(tile);
    expect(onIntent).not.toHaveBeenCalled();
  });

  it("shows the art at the URL artUrl names for the card's art", () => {
    render(<CardTile card={card} artUrl={named} />);

    const art = screen.getByRole('button').querySelector('img');
    expect(art).toHaveAttribute('src', '/art/1936.avif');
  });

  it("hands artUrl the printing's art when the tile shows a printing", () => {
    render(<CardTile card={card} printing={enchanted} artUrl={named} />);

    const name = 'Bruno Madrigal - Undetected Uncle, Enchanted printing';
    const tile = screen.getByRole('button', {name});
    expect(tile.querySelector('img')).toHaveAttribute('src', '/art/1936-ench.avif');
  });
});
