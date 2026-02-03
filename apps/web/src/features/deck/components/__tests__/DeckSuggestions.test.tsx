import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {describe, it, expect, vi} from 'vitest';
import {DeckSuggestions} from '../DeckSuggestions';
import {CardPreviewProvider} from '../../../cards/components/CardPreviewContext';
import {createCard} from '../../../../shared/test-utils/factories';
import type {DeckSuggestion} from '../../hooks';

const renderWithProvider = (ui: React.ReactElement) => {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
};

const createSuggestion = (overrides: Partial<DeckSuggestion> = {}): DeckSuggestion => ({
  card: createCard(),
  synergyCount: 3,
  totalStrength: 6,
  synergizingWith: ['Card A', 'Card B', 'Card C'],
  ...overrides,
});

describe('DeckSuggestions', () => {
  describe('rendering', () => {
    it('should render nothing when suggestions array is empty', () => {
      const {container} = renderWithProvider(
        <DeckSuggestions suggestions={[]} onAddCard={vi.fn()} />,
      );

      expect(container.firstChild).toBeNull();
    });

    it('should render Suggestions title when there are suggestions', () => {
      const suggestions = [createSuggestion()];
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });

    it('should render card names', () => {
      const suggestions = [
        createSuggestion({card: createCard({name: 'Elsa'})}),
        createSuggestion({card: createCard({name: 'Anna'})}),
      ];
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      expect(screen.getByText('Elsa')).toBeInTheDocument();
      expect(screen.getByText('Anna')).toBeInTheDocument();
    });

    it('should show synergy count for each suggestion', () => {
      const suggestions = [
        createSuggestion({synergyCount: 5}),
        createSuggestion({card: createCard({id: '2'}), synergyCount: 3}),
      ];
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      expect(screen.getByText('Synergizes with 5 cards')).toBeInTheDocument();
      expect(screen.getByText('Synergizes with 3 cards')).toBeInTheDocument();
    });

    it('should limit displayed suggestions to 8', () => {
      const suggestions = Array.from({length: 12}, (_, i) =>
        createSuggestion({card: createCard({id: `card-${i}`, name: `Card ${i}`})}),
      );
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      // Should show only first 8
      expect(screen.getByText('Card 0')).toBeInTheDocument();
      expect(screen.getByText('Card 7')).toBeInTheDocument();
      expect(screen.queryByText('Card 8')).not.toBeInTheDocument();
    });

    it('should render card image when available', () => {
      const suggestions = [
        createSuggestion({
          card: createCard({name: 'Test', imageUrl: 'https://example.com/card.png'}),
        }),
      ];
      const {container} = renderWithProvider(
        <DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />,
      );

      const img = container.querySelector('img[src="https://example.com/card.png"]');
      expect(img).toBeTruthy();
    });

    it('should show cost fallback when image fails to load', async () => {
      const {fireEvent, waitFor} = await import('@testing-library/react');
      const suggestions = [
        createSuggestion({
          card: createCard({name: 'Test', cost: 4, imageUrl: 'https://invalid.url/fail.png'}),
        }),
      ];
      const {container} = renderWithProvider(
        <DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />,
      );

      const img = container.querySelector('img');
      expect(img).toBeTruthy();

      // Simulate image error using fireEvent for proper act() wrapping
      if (img) {
        fireEvent.error(img);
      }

      // After error, should show cost in fallback div
      await waitFor(() => {
        expect(screen.getByText('4')).toBeInTheDocument();
      });
    });

    it('should show cost placeholder when no image URL', () => {
      const suggestions = [
        createSuggestion({
          card: createCard({name: 'Test', cost: 7, imageUrl: undefined}),
        }),
      ];
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });

  describe('add card functionality', () => {
    it('should call onAddCard when add button is clicked', async () => {
      const user = userEvent.setup();
      const onAddCard = vi.fn();
      const card = createCard({name: 'Mickey'});
      const suggestions = [createSuggestion({card})];

      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={onAddCard} />);

      const addButton = screen.getByTitle('Add to deck');
      await user.click(addButton);

      expect(onAddCard).toHaveBeenCalledTimes(1);
      expect(onAddCard).toHaveBeenCalledWith(card);
    });

    it('should stop event propagation on add button click', async () => {
      const user = userEvent.setup();
      const onAddCard = vi.fn();
      const containerClick = vi.fn();
      const suggestions = [createSuggestion()];

      render(
        <CardPreviewProvider>
          <div onClick={containerClick}>
            <DeckSuggestions suggestions={suggestions} onAddCard={onAddCard} />
          </div>
        </CardPreviewProvider>,
      );

      const addButton = screen.getByTitle('Add to deck');
      await user.click(addButton);

      expect(onAddCard).toHaveBeenCalled();
      expect(containerClick).not.toHaveBeenCalled();
    });
  });

  describe('collapsible behavior', () => {
    it('should support collapsed state', () => {
      const suggestions = [createSuggestion()];
      renderWithProvider(
        <DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} collapsed={true} />,
      );

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });

    it('should call onToggleCollapse when header is clicked', async () => {
      const user = userEvent.setup();
      const onToggle = vi.fn();
      const suggestions = [createSuggestion()];

      renderWithProvider(
        <DeckSuggestions
          suggestions={suggestions}
          onAddCard={vi.fn()}
          onToggleCollapse={onToggle}
        />,
      );

      await user.click(screen.getByText('Suggestions'));

      expect(onToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('synergizingWith tooltip', () => {
    it('should have title showing which cards it synergizes with', () => {
      const suggestions = [
        createSuggestion({
          synergizingWith: ['Simba', 'Nala', 'Mufasa'],
        }),
      ];
      renderWithProvider(<DeckSuggestions suggestions={suggestions} onAddCard={vi.fn()} />);

      const synergyText = screen.getByText(/Synergizes with/);
      expect(synergyText).toHaveAttribute('title', 'Simba, Nala, Mufasa');
    });
  });
});
