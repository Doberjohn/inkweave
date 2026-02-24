import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardList} from '../CardList';
import {CardPreviewProvider} from '../CardPreviewContext';
import {createCard} from '../../../../shared/test-utils';
import type {LorcanaCard} from '../../types';
import type {CardFilterOptions} from '../../loader';

// Wrapper to provide required context
function renderWithProvider(ui: React.ReactElement) {
  return render(<CardPreviewProvider>{ui}</CardPreviewProvider>);
}

describe('CardList', () => {
  const mockCards: LorcanaCard[] = [
    createCard({id: '1', name: 'Elsa', fullName: 'Elsa - Snow Queen', ink: 'Sapphire', cost: 5}),
    createCard({id: '2', name: 'Simba', fullName: 'Simba - Future King', ink: 'Amber', cost: 3}),
    createCard({
      id: '3',
      name: 'Maleficent',
      fullName: 'Maleficent - Sorceress',
      ink: 'Amethyst',
      cost: 7,
    }),
  ];

  const defaultProps = {
    cards: mockCards,
    isLoading: false,
    selectedCard: null,
    searchQuery: '',
    inkFilters: [] as string[],
    typeFilters: [] as string[],
    costFilters: [] as number[],
    filters: {} as CardFilterOptions,
    uniqueKeywords: ['Evasive', 'Singer', 'Challenger'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    uniqueSets: ['1', '2', '3'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '2', name: 'Rise of the Floodborn', number: 2},
      {code: '3', name: 'Into the Inklands', number: 3},
    ],
    onSearchChange: vi.fn(),
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onFiltersChange: vi.fn(),
    onCardSelect: vi.fn(),
    onClearAll: vi.fn(),
    activeFilterCount: 0,
  };

  /** Get card tile buttons via data-testid (stable across style changes) */
  function getCardButtons() {
    return screen.getAllByTestId('card-tile');
  }

  describe('Desktop layout', () => {
    it('should render loading spinner when loading', () => {
      renderWithProvider(<CardList {...defaultProps} isLoading={true} />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('should render card tiles when not loading', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      expect(getCardButtons()).toHaveLength(3);
    });

    it('should call onSearchChange when typing in search', () => {
      const onSearchChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onSearchChange={onSearchChange} />);

      const searchInput = screen.getByPlaceholderText('Search cards...');
      fireEvent.change(searchInput, {target: {value: 'Elsa'}});

      expect(onSearchChange).toHaveBeenCalledWith('Elsa');
    });

    it('should call onCardSelect when card clicked', () => {
      const onCardSelect = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onCardSelect={onCardSelect} />);

      const cardButtons = getCardButtons();
      fireEvent.click(cardButtons[0]);

      expect(onCardSelect).toHaveBeenCalledWith(mockCards[0]);
    });

    it('should show selected state on selected card', () => {
      renderWithProvider(<CardList {...defaultProps} selectedCard={mockCards[0]} />);

      const cardButtons = getCardButtons();
      expect(cardButtons[0]).toHaveAttribute('aria-pressed', 'true');
    });

    it('should render filter button when onFiltersClick provided', () => {
      const onFiltersClick = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersClick={onFiltersClick} />);

      const filterButton = screen.getByRole('button', {name: /Filters/i});
      fireEvent.click(filterButton);

      expect(onFiltersClick).toHaveBeenCalled();
    });

    it('should show active filter count badge', () => {
      renderWithProvider(
        <CardList
          {...defaultProps}
          inkFilters={['Sapphire']}
          activeFilterCount={1}
          onFiltersClick={vi.fn()}
        />,
      );

      expect(screen.getByRole('button', {name: /Filters \(1 active\)/i})).toBeInTheDocument();
    });
  });

  describe('Mobile layout', () => {
    it('should render mobile layout when isMobile is true', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} />);

      // Mobile has filter button
      expect(screen.getByRole('button', {name: /Filters/i})).toBeInTheDocument();
    });

    it('should show filter badge count when filters are active', () => {
      renderWithProvider(
        <CardList
          {...defaultProps}
          isMobile={true}
          inkFilters={['Sapphire']}
          activeFilterCount={1}
        />,
      );

      expect(screen.getByRole('button', {name: /Filters \(1 active\)/i})).toBeInTheDocument();
    });

    it('should render loading spinner in mobile layout', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} isLoading={true} />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('should render card tiles in mobile layout', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} />);

      expect(getCardButtons()).toHaveLength(3);
    });

    it('should call onSearchChange in mobile layout', () => {
      const onSearchChange = vi.fn();
      renderWithProvider(
        <CardList {...defaultProps} isMobile={true} onSearchChange={onSearchChange} />,
      );

      const searchInput = screen.getByPlaceholderText('Search cards...');
      fireEvent.change(searchInput, {target: {value: 'test'}});

      expect(onSearchChange).toHaveBeenCalledWith('test');
    });

    it('should call onCardSelect when card clicked in mobile layout', () => {
      const onCardSelect = vi.fn();
      renderWithProvider(
        <CardList {...defaultProps} isMobile={true} onCardSelect={onCardSelect} />,
      );

      const cardButtons = getCardButtons();
      fireEvent.click(cardButtons[0]);

      expect(onCardSelect).toHaveBeenCalledWith(mockCards[0]);
    });

    it('should show selected card state in mobile layout', () => {
      renderWithProvider(
        <CardList {...defaultProps} isMobile={true} selectedCard={mockCards[0]} />,
      );

      const cardButtons = getCardButtons();
      expect(cardButtons[0]).toHaveAttribute('aria-pressed', 'true');
    });
  });
});
