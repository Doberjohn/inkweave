import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardTile} from '../CardTile';
import {createCard} from '../../../../shared/test-utils';

describe('CardTile', () => {
  const mockCard = createCard({
    id: 'card-1',
    name: 'Elsa',
    version: 'Snow Queen',
    fullName: 'Elsa - Snow Queen',
    cost: 5,
    ink: 'Sapphire',
    keywords: ['Singer 5', 'Evasive'],
  });

  const defaultProps = {
    card: mockCard,
    onClick: vi.fn(),
    isSelected: false,
  };

  it('should render image from imageUrl', () => {
    const cardWithImage = createCard({
      ...mockCard,
      imageUrl: 'https://example.com/elsa.avif',
    });
    const {container} = render(<CardTile {...defaultProps} card={cardWithImage} />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/elsa.avif');
  });

  it('should use small image URL when useSmallImage is true', () => {
    const cardWithImage = createCard({
      ...mockCard,
      imageUrl: '/card-images/123.avif',
    });
    const {container} = render(
      <CardTile {...defaultProps} card={cardWithImage} useSmallImage />,
    );

    const img = container.querySelector('img');
    expect(img).toHaveAttribute('src', '/card-images/123-sm.avif');
  });

  it('should show cost fallback when no image available', () => {
    const cardNoImage = createCard({...mockCard, imageUrl: undefined});
    render(<CardTile {...defaultProps} card={cardNoImage} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(<CardTile {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  // Regression guard: mobile browsers fire touchstart → synthesized click.
  // A previous version of CardTile's onClick gated on isSyntheticMouseEvent(),
  // which returned true for <1000ms after any touchstart — blocking every
  // mobile tap. This test ensures tapping still triggers navigation.
  it('should call onClick even when a touchstart preceded it (mobile tap sequence)', () => {
    const onClick = vi.fn();
    render(<CardTile {...defaultProps} onClick={onClick} />);

    // Simulate the iOS tap sequence: touchstart on document, then click on the button.
    fireEvent.touchStart(document, {touches: [{clientX: 100, clientY: 200}]});
    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should show selected state with aria-pressed', () => {
    const {rerender} = render(<CardTile {...defaultProps} isSelected={false} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<CardTile {...defaultProps} isSelected={true} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it("should show a given printing's art and name it, while selecting the card", () => {
    const onSelect = vi.fn();
    const cardWithImage = createCard({...mockCard, imageUrl: '/card-images/card-1.avif'});
    const enchanted = {id: 'card-1-ench', rarity: 'Enchanted' as const, number: 205, imageUrl: '/card-images/ench.avif'};
    render(<CardTile card={cardWithImage} printing={enchanted} onSelect={onSelect} isSelected={false} useSmallImage />);

    const tile = screen.getByRole('button', {name: 'Elsa - Snow Queen, Enchanted printing'});
    expect(tile.querySelector('img')).toHaveAttribute('src', '/card-images/ench-sm.avif');
    fireEvent.click(tile);
    expect(onSelect).toHaveBeenCalledWith(cardWithImage);
  });

  // The hover glow is a CSS rule (`.card-tile`, index.css) that adds to the resting shadow. An
  // inline box-shadow would beat that rule, and the glow would never show.
  it('keeps its resting shadow out of the inline box-shadow, so the hover glow can show', () => {
    render(<CardTile {...defaultProps} />);
    const tile = screen.getByRole('button');
    expect(tile.style.boxShadow).toBe('');
    expect(tile.style.getPropertyValue('--tile-shadow')).not.toBe('');
    expect(tile.style.getPropertyValue('--tile-glow-soft')).not.toBe('');
  });

  it('is a plain button, not a toggle, where no selection is passed', () => {
    // The binder: a click opens the card, so "toggle button, not pressed" would mislead.
    render(<CardTile card={mockCard} onSelect={vi.fn()} />);
    expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
  });

  it('names a card of an alt-art rarity as that printing, as a binder pocket holds it', () => {
    render(<CardTile card={createCard({...mockCard, rarity: 'Enchanted'})} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Elsa - Snow Queen, Enchanted printing'})).toBeInTheDocument();
  });

  it("names a pocket for a printing that keeps its base card's rarity as an alt foil (#802)", () => {
    const pocket = createCard({...mockCard, rarity: 'Super Rare', setNumber: 247, baseId: '3147'});
    render(<CardTile card={pocket} onSelect={vi.fn()} />);
    expect(screen.getByRole('button', {name: 'Elsa - Snow Queen, Alt foil printing'})).toBeInTheDocument();
  });

  // A promo's card is named by its promo set, its set code (#805). One with no set code falls back
  // to its number, though no data holds such a card since #805 took LorcanaJSON's out of the chunks.
  it('names a Special card with no set by its number (#802)', () => {
    const promo = createCard({...mockCard, rarity: 'Special', setNumber: 3, baseId: '41'});
    render(<CardTile card={promo} onSelect={vi.fn()} />);
    const name = 'Elsa - Snow Queen, #3 printing';
    expect(screen.getByRole('button', {name})).toBeInTheDocument();
  });

});
