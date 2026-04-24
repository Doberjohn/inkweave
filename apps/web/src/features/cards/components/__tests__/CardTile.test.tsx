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

  it('should show selected state with aria-pressed', () => {
    const {rerender} = render(<CardTile {...defaultProps} isSelected={false} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(<CardTile {...defaultProps} isSelected={true} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

});
