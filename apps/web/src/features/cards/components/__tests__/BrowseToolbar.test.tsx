import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {BrowseToolbar} from '../BrowseToolbar';
import type {CardFilterOptions} from '../../loader';
import type {Ink} from 'lorcana-synergy-engine';
import type {CardTypeFilter, BrowseSortOrder} from '../../../../shared/constants';

function defaultProps(overrides: Partial<Parameters<typeof BrowseToolbar>[0]> = {}) {
  return {
    resultCount: 100,
    totalCount: 1432,
    onFiltersClick: vi.fn(),
    activeFilterCount: 0,
    inkFilters: [] as Ink[],
    typeFilters: [] as CardTypeFilter[],
    costFilters: [] as number[],
    filters: {} as CardFilterOptions,
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onFiltersChange: vi.fn(),
    onClearAll: vi.fn(),
    sortOrder: 'newest' as BrowseSortOrder,
    onSortChange: vi.fn(),
    isMobile: false,
    ...overrides,
  };
}

describe('BrowseToolbar', () => {
  it('renders filters button and result count', () => {
    render(<BrowseToolbar {...defaultProps()} />);

    expect(screen.getByRole('button', {name: 'Filters'})).toBeInTheDocument();
    expect(screen.getByTestId('result-count')).toHaveTextContent('100');
    expect(screen.getByTestId('result-count')).toHaveTextContent('of 1432 cards');
  });

  it('shows "cards" without total when all match', () => {
    render(<BrowseToolbar {...defaultProps({resultCount: 1432, totalCount: 1432})} />);

    expect(screen.getByTestId('result-count')).toHaveTextContent('1432');
    expect(screen.getByTestId('result-count')).toHaveTextContent('cards');
    expect(screen.getByTestId('result-count')).not.toHaveTextContent('of');
  });

  it('calls onFiltersClick when Filters button clicked', () => {
    const onFiltersClick = vi.fn();
    render(<BrowseToolbar {...defaultProps({onFiltersClick})} />);

    fireEvent.click(screen.getByRole('button', {name: 'Filters'}));

    expect(onFiltersClick).toHaveBeenCalledOnce();
  });

  it('shows filter count badge when activeFilterCount > 0', () => {
    render(<BrowseToolbar {...defaultProps({activeFilterCount: 3})} />);

    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('renders ink filter chips that dismiss on click', () => {
    const onToggleInk = vi.fn();
    render(
      <BrowseToolbar {...defaultProps({inkFilters: ['Amethyst', 'Ruby'] as Ink[], onToggleInk})} />,
    );

    expect(screen.getByText('Amethyst')).toBeInTheDocument();
    expect(screen.getByText('Ruby')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Amethyst'));
    expect(onToggleInk).toHaveBeenCalledWith('Amethyst');
  });

  it('renders type filter chips that dismiss on click', () => {
    const onToggleType = vi.fn();
    render(
      <BrowseToolbar
        {...defaultProps({typeFilters: ['Character'] as CardTypeFilter[], onToggleType})}
      />,
    );

    expect(screen.getByText('Character')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Character'));
    expect(onToggleType).toHaveBeenCalledWith('Character');
  });

  it('renders cost filter chips that dismiss on click', () => {
    const onToggleCost = vi.fn();
    render(<BrowseToolbar {...defaultProps({costFilters: [3, 5], onToggleCost})} />);

    expect(screen.getByText('Cost 3')).toBeInTheDocument();
    expect(screen.getByText('Cost 5')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Cost 3'));
    expect(onToggleCost).toHaveBeenCalledWith(3);
  });

  it('shows Clear all button when chips are present', () => {
    const onClearAll = vi.fn();
    render(<BrowseToolbar {...defaultProps({inkFilters: ['Sapphire'] as Ink[], onClearAll})} />);

    const clearBtn = screen.getByText('Clear all');
    expect(clearBtn).toBeInTheDocument();

    fireEvent.click(clearBtn);
    expect(onClearAll).toHaveBeenCalledOnce();
  });

  it('renders sort select on desktop', () => {
    render(<BrowseToolbar {...defaultProps({isMobile: false})} />);

    const select = screen.getByRole('combobox', {name: 'Sort cards'});
    expect(select).toBeInTheDocument();
    expect(select).toHaveValue('newest');
  });

  it('hides sort select on mobile', () => {
    render(<BrowseToolbar {...defaultProps({isMobile: true})} />);

    expect(screen.queryByRole('combobox', {name: 'Sort cards'})).not.toBeInTheDocument();
  });

  it('fires onSortChange when sort is changed', () => {
    const onSortChange = vi.fn();
    render(<BrowseToolbar {...defaultProps({onSortChange})} />);

    fireEvent.change(screen.getByRole('combobox', {name: 'Sort cards'}), {
      target: {value: 'name-asc'},
    });

    expect(onSortChange).toHaveBeenCalledWith('name-asc');
  });
});
