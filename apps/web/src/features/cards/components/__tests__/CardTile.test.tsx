import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardTile} from '../CardTile';
import {CardPreviewProvider} from '../CardPreviewContext';
import {createCard} from '../../../../shared/test-utils';

// Wrapper to provide required context
function renderWithProvider(ui: React.ReactElement) {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
}

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
    const {container} = renderWithProvider(<CardTile {...defaultProps} card={cardWithImage} />);

    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/elsa.avif');
  });

  it('should show cost fallback when no image available', () => {
    const cardNoImage = createCard({...mockCard, imageUrl: undefined});
    renderWithProvider(<CardTile {...defaultProps} card={cardNoImage} />);

    expect(screen.getByText('5')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithProvider(<CardTile {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('should show selected state with aria-pressed', () => {
    const {rerender} = renderWithProvider(<CardTile {...defaultProps} isSelected={false} />);

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <CardPreviewProvider>
        <CardTile {...defaultProps} isSelected={true} />
      </CardPreviewProvider>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  describe('Mouse preview interactions', () => {
    it('should show preview on mouse enter', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button, {clientX: 100, clientY: 200});

      expect(button).toBeInTheDocument();
    });

    it('should update preview position on mouse move', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.mouseMove(button, {clientX: 150, clientY: 250});

      expect(button).toBeInTheDocument();
    });

    it('should hide preview on mouse leave', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button');
      fireEvent.mouseEnter(button, {clientX: 100, clientY: 200});
      fireEvent.mouseLeave(button);

      expect(button).toBeInTheDocument();
    });
  });
});
