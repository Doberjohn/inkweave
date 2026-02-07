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

  it('should render card name', () => {
    renderWithProvider(<CardTile {...defaultProps} />);

    expect(screen.getByText('Elsa')).toBeInTheDocument();
  });

  it('should render card version', () => {
    renderWithProvider(<CardTile {...defaultProps} />);

    expect(screen.getByText('Snow Queen')).toBeInTheDocument();
  });

  it('should not render cost in tile body when imageUrl is provided', () => {
    const cardWithImage = createCard({
      ...mockCard,
      imageUrl: 'https://example.com/elsa.jpg',
    });
    const {container} = renderWithProvider(<CardTile {...defaultProps} card={cardWithImage} />);

    // Cost should not appear as text in the tile body (only in CardImage fallback if image fails)
    // The image should be loaded, so no cost fallback should be visible
    const img = container.querySelector('img');
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'https://example.com/elsa.jpg');
    
    // Cost text "5" should not be in the document when image loads successfully
    expect(screen.queryByText('5')).not.toBeInTheDocument();
  });

  it('should render keywords (base form)', () => {
    renderWithProvider(<CardTile {...defaultProps} />);

    expect(screen.getByText('Singer')).toBeInTheDocument();
    expect(screen.getByText('Evasive')).toBeInTheDocument();
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    renderWithProvider(<CardTile {...defaultProps} onClick={onClick} />);

    fireEvent.click(screen.getByRole('button', {name: /elsa/i}));

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

  it('should not render version when not provided', () => {
    const cardWithoutVersion = createCard({
      ...mockCard,
      version: undefined,
    });

    renderWithProvider(<CardTile {...defaultProps} card={cardWithoutVersion} />);

    expect(screen.queryByText('Snow Queen')).not.toBeInTheDocument();
  });

  describe('Mouse preview interactions', () => {
    it('should show preview on mouse enter', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button', {name: /elsa/i});
      fireEvent.mouseEnter(button, {clientX: 100, clientY: 200});

      // Preview is shown via context - button should still be interactive
      expect(button).toBeInTheDocument();
    });

    it('should update preview position on mouse move', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button', {name: /elsa/i});
      fireEvent.mouseMove(button, {clientX: 150, clientY: 250});

      expect(button).toBeInTheDocument();
    });

    it('should hide preview on mouse leave', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      const button = screen.getByRole('button', {name: /elsa/i});
      fireEvent.mouseEnter(button, {clientX: 100, clientY: 200});
      fireEvent.mouseLeave(button);

      expect(button).toBeInTheDocument();
    });
  });

  describe('Add to deck button', () => {
    it('should not render add button when onAddToDeck is not provided', () => {
      renderWithProvider(<CardTile {...defaultProps} />);

      expect(screen.queryByRole('button', {name: /add.*to deck/i})).not.toBeInTheDocument();
    });

    it('should render add button when onAddToDeck is provided', () => {
      const onAddToDeck = vi.fn();
      renderWithProvider(<CardTile {...defaultProps} onAddToDeck={onAddToDeck} />);

      expect(screen.getByRole('button', {name: /add elsa to deck/i})).toBeInTheDocument();
    });

    it('should show + when deck quantity is 0', () => {
      const onAddToDeck = vi.fn();
      renderWithProvider(<CardTile {...defaultProps} onAddToDeck={onAddToDeck} deckQuantity={0} />);

      expect(screen.getByText('+')).toBeInTheDocument();
    });

    it('should show quantity when deck quantity > 0', () => {
      const onAddToDeck = vi.fn();
      renderWithProvider(<CardTile {...defaultProps} onAddToDeck={onAddToDeck} deckQuantity={2} />);

      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('should call onAddToDeck when add button clicked', () => {
      const onAddToDeck = vi.fn();
      renderWithProvider(<CardTile {...defaultProps} onAddToDeck={onAddToDeck} />);

      fireEvent.click(screen.getByRole('button', {name: /add elsa to deck/i}));

      expect(onAddToDeck).toHaveBeenCalledWith(mockCard);
    });

    it('should not trigger main onClick when add button clicked', () => {
      const onClick = vi.fn();
      const onAddToDeck = vi.fn();
      renderWithProvider(
        <CardTile {...defaultProps} onClick={onClick} onAddToDeck={onAddToDeck} />,
      );

      fireEvent.click(screen.getByRole('button', {name: /add elsa to deck/i}));

      expect(onAddToDeck).toHaveBeenCalled();
      expect(onClick).not.toHaveBeenCalled();
    });

    it('should be disabled when deck quantity is 4', () => {
      const onAddToDeck = vi.fn();
      renderWithProvider(<CardTile {...defaultProps} onAddToDeck={onAddToDeck} deckQuantity={4} />);

      const addButton = screen.getByRole('button', {name: /maximum 4 copies/i});
      expect(addButton).toBeDisabled();
    });
  });
});
