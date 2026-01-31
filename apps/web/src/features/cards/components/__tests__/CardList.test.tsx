import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {CardList} from '../CardList';
import {CardPreviewProvider} from '../CardPreviewContext';
import {createCard} from '../../../../shared/test-utils';
import type {LorcanaCard, Ink} from '../../types';
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
    inkFilter: 'all' as Ink | 'all',
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
    onInkFilterChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onCardSelect: vi.fn(),
  };

  describe('Desktop layout', () => {
    it('should render loading spinner when loading', () => {
      renderWithProvider(<CardList {...defaultProps} isLoading={true} />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('should render card list when not loading', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      expect(screen.getByText('Elsa')).toBeInTheDocument();
      expect(screen.getByText('Simba')).toBeInTheDocument();
      expect(screen.getByText('Maleficent')).toBeInTheDocument();
    });

    it('should render card count', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      expect(screen.getByText(/Showing 3 of 3 cards/)).toBeInTheDocument();
    });

    it('should call onSearchChange when typing in search', () => {
      const onSearchChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onSearchChange={onSearchChange} />);

      const searchInput = screen.getByPlaceholderText('Search cards...');
      fireEvent.change(searchInput, {target: {value: 'Elsa'}});

      expect(onSearchChange).toHaveBeenCalledWith('Elsa');
    });

    it('should render ink filter buttons', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      // There are two "All" buttons (one for Ink, one for Type)
      const allButtons = screen.getAllByRole('button', {name: 'All'});
      expect(allButtons.length).toBe(2);
      expect(screen.getByRole('button', {name: 'Amber'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Sapphire'})).toBeInTheDocument();
    });

    it('should call onInkFilterChange when ink button clicked', () => {
      const onInkFilterChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onInkFilterChange={onInkFilterChange} />);

      fireEvent.click(screen.getByRole('button', {name: 'Sapphire'}));

      expect(onInkFilterChange).toHaveBeenCalledWith('Sapphire');
    });

    it('should show active state on selected ink filter', () => {
      renderWithProvider(<CardList {...defaultProps} inkFilter="Sapphire" />);

      const sapphireButton = screen.getByRole('button', {name: 'Sapphire'});
      expect(sapphireButton).toHaveAttribute('aria-pressed', 'true');
    });

    it("should call onInkFilterChange with 'all' when clicking All in ink filter", () => {
      const onInkFilterChange = vi.fn();
      renderWithProvider(
        <CardList {...defaultProps} inkFilter="Sapphire" onInkFilterChange={onInkFilterChange} />,
      );

      // First "All" button is for ink filter
      const allButtons = screen.getAllByRole('button', {name: 'All'});
      fireEvent.click(allButtons[0]);

      expect(onInkFilterChange).toHaveBeenCalledWith('all');
    });

    it('should call onFiltersChange to clear type when clicking All in type filter', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(
        <CardList
          {...defaultProps}
          filters={{type: 'Character'}}
          onFiltersChange={onFiltersChange}
        />,
      );

      // Second "All" button is for type filter
      const allButtons = screen.getAllByRole('button', {name: 'All'});
      fireEvent.click(allButtons[1]);

      expect(onFiltersChange).toHaveBeenCalledWith({});
    });

    it('should render type filter buttons', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      expect(screen.getByRole('button', {name: 'Character'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Action'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Item'})).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Location'})).toBeInTheDocument();
    });

    it('should call onFiltersChange when type button clicked', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByRole('button', {name: 'Character'}));

      expect(onFiltersChange).toHaveBeenCalledWith({type: 'Character'});
    });

    it('should expand more filters when toggle clicked', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      // Initially, cost filter should not be visible
      expect(screen.queryByText('Cost')).not.toBeInTheDocument();

      // Click more filters toggle
      fireEvent.click(screen.getByText(/More filters/));

      // Now cost filter should be visible
      expect(screen.getByText('Cost')).toBeInTheDocument();
      expect(screen.getByText('Keyword')).toBeInTheDocument();
      expect(screen.getByText('Classification')).toBeInTheDocument();
      expect(screen.getByText('Set')).toBeInTheDocument();
    });

    it('should render keyword options in dropdown', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      fireEvent.click(screen.getByText(/More filters/));

      // Check that the dropdowns have expected options
      expect(screen.getByText('Any keyword')).toBeInTheDocument();
      expect(screen.getByText('Any classification')).toBeInTheDocument();
      expect(screen.getByText('Any set')).toBeInTheDocument();
    });

    it('should call onFiltersChange when selecting min cost', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByText(/More filters/));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[0], {target: {value: '3'}});

      expect(onFiltersChange).toHaveBeenCalledWith({minCost: 3});
    });

    it('should call onFiltersChange when selecting max cost', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByText(/More filters/));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[1], {target: {value: '7'}});

      expect(onFiltersChange).toHaveBeenCalledWith({maxCost: 7});
    });

    it('should call onFiltersChange when selecting keyword', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByText(/More filters/));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[2], {target: {value: 'Evasive'}});

      expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Evasive']});
    });

    it('should call onFiltersChange when selecting classification', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByText(/More filters/));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[3], {target: {value: 'Princess'}});

      expect(onFiltersChange).toHaveBeenCalledWith({classifications: ['Princess']});
    });

    it('should call onFiltersChange when selecting set', () => {
      const onFiltersChange = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onFiltersChange={onFiltersChange} />);

      fireEvent.click(screen.getByText(/More filters/));

      const selects = screen.getAllByRole('combobox');
      fireEvent.change(selects[4], {target: {value: '2'}});

      expect(onFiltersChange).toHaveBeenCalledWith({setCode: '2'});
    });

    it('should call onCardSelect when card clicked', () => {
      const onCardSelect = vi.fn();
      renderWithProvider(<CardList {...defaultProps} onCardSelect={onCardSelect} />);

      fireEvent.click(screen.getByRole('button', {name: /elsa/i}));

      expect(onCardSelect).toHaveBeenCalledWith(mockCards[0]);
    });

    it('should show selected state on selected card', () => {
      renderWithProvider(<CardList {...defaultProps} selectedCard={mockCards[0]} />);

      const elsaButton = screen.getByRole('button', {name: /elsa/i});
      expect(elsaButton).toHaveAttribute('aria-pressed', 'true');
    });

    it('should show Clear all filters button when filters active', () => {
      renderWithProvider(<CardList {...defaultProps} searchQuery="test" />);

      expect(screen.getByText('Clear all filters')).toBeInTheDocument();
    });

    it('should not show Clear all filters button when no filters active', () => {
      renderWithProvider(<CardList {...defaultProps} />);

      expect(screen.queryByText('Clear all filters')).not.toBeInTheDocument();
    });

    it('should call clear handlers when Clear all filters clicked', () => {
      const onSearchChange = vi.fn();
      const onInkFilterChange = vi.fn();
      const onFiltersChange = vi.fn();
      renderWithProvider(
        <CardList
          {...defaultProps}
          searchQuery="test"
          onSearchChange={onSearchChange}
          onInkFilterChange={onInkFilterChange}
          onFiltersChange={onFiltersChange}
        />,
      );

      fireEvent.click(screen.getByText('Clear all filters'));

      expect(onFiltersChange).toHaveBeenCalledWith({});
      expect(onInkFilterChange).toHaveBeenCalledWith('all');
      expect(onSearchChange).toHaveBeenCalledWith('');
    });
  });

  describe('Mobile layout', () => {
    it('should render mobile layout when isMobile is true', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} />);

      // Mobile has filter button instead of inline filters
      expect(screen.getByRole('button', {name: /Filters/i})).toBeInTheDocument();
    });

    it('should render card count in mobile layout', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} />);

      expect(screen.getByText('3 of 3 cards')).toBeInTheDocument();
    });

    it('should show filter badge count when filters are active', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} inkFilter="Sapphire" />);

      // Should show badge with count on filter button
      expect(screen.getByRole('button', {name: /Filters \(1 active\)/i})).toBeInTheDocument();
    });

    it('should render loading spinner in mobile layout', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} isLoading={true} />);

      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });

    it('should render cards in mobile layout', () => {
      renderWithProvider(<CardList {...defaultProps} isMobile={true} />);

      expect(screen.getByText('Elsa')).toBeInTheDocument();
      expect(screen.getByText('Simba')).toBeInTheDocument();
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

      fireEvent.click(screen.getByRole('button', {name: /elsa/i}));

      expect(onCardSelect).toHaveBeenCalledWith(mockCards[0]);
    });

    it('should show selected card state in mobile layout', () => {
      renderWithProvider(
        <CardList {...defaultProps} isMobile={true} selectedCard={mockCards[0]} />,
      );

      const elsaButton = screen.getByRole('button', {name: /elsa/i});
      expect(elsaButton).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Add to deck functionality', () => {
    it('should pass onAddToDeck to CardTile', () => {
      const onAddToDeck = vi.fn().mockReturnValue(true);
      renderWithProvider(<CardList {...defaultProps} onAddToDeck={onAddToDeck} />);

      // The add button should appear on cards
      expect(screen.getByRole('button', {name: /add elsa to deck/i})).toBeInTheDocument();
    });

    it('should pass getCardQuantity to CardTile', () => {
      // Return quantity only for the first card to make assertions easier
      const getCardQuantity = vi.fn((id: string) => (id === '1' ? 2 : 0));
      const onAddToDeck = vi.fn().mockReturnValue(true);
      renderWithProvider(
        <CardList {...defaultProps} onAddToDeck={onAddToDeck} getCardQuantity={getCardQuantity} />,
      );

      // Should show quantity badge - there will be multiple "2"s but at least one
      const twoElements = screen.getAllByText('2');
      expect(twoElements.length).toBeGreaterThanOrEqual(1);
    });
  });
});
