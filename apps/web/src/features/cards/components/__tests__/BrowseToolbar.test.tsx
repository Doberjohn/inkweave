import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {BrowseToolbar} from '../BrowseToolbar';
import type {CardFilterOptions} from '../../loader';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardTypeFilter, BrowseSortOrder} from '../../../../shared/constants';

// The cost-tuck breakpoint is viewport-driven (useInlineCostFilters reads
// window.innerWidth). jsdom defaults to 1024 — below the threshold — so cost is
// "tucked" (shown as a chip) by default; stub a wider width to exercise the
// inline-icons branch.
function setViewport(width: number) {
  vi.stubGlobal('innerWidth', width);
}

afterEach(() => {
  vi.unstubAllGlobals();
});

function defaultProps(overrides: Partial<Parameters<typeof BrowseToolbar>[0]> = {}) {
  return {
    onFiltersClick: vi.fn(),
    activeFilterCount: 0,
    inkFilters: [] as Ink[],
    typeFilters: [] as CardTypeFilter[],
    costFilters: [] as number[],
    filters: {} as CardFilterOptions,
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onClearCosts: vi.fn(),
    onFiltersChange: vi.fn(),
    sortOrder: 'newest' as BrowseSortOrder,
    onSortChange: vi.fn(),
    isMobile: false,
    ...overrides,
  };
}

describe('BrowseToolbar', () => {
  it('renders filters button', () => {
    render(<BrowseToolbar {...defaultProps()} />);

    expect(screen.getByRole('button', {name: 'Filters'})).toBeInTheDocument();
  });

  it('calls onFiltersClick when Filters button clicked', () => {
    const onFiltersClick = vi.fn();
    render(<BrowseToolbar {...defaultProps({onFiltersClick})} />);

    fireEvent.click(screen.getByRole('button', {name: 'Filters'}));

    expect(onFiltersClick).toHaveBeenCalledOnce();
  });

  it('shows filter count badge when activeFilterCount > 0', () => {
    render(<BrowseToolbar {...defaultProps({activeFilterCount: 3})} />);

    const filtersBtn = screen.getByLabelText('Filters');
    expect(within(filtersBtn).getByText('3')).toBeInTheDocument();
  });

  it('renders ink filter chips on mobile that dismiss on click', () => {
    const onToggleInk = vi.fn();
    render(
      <BrowseToolbar
        {...defaultProps({inkFilters: ['Amethyst', 'Ruby'] as Ink[], onToggleInk, isMobile: true})}
      />,
    );

    expect(screen.getByText('Amethyst')).toBeInTheDocument();
    expect(screen.getByText('Ruby')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Amethyst'));
    expect(onToggleInk).toHaveBeenCalledWith('Amethyst');
  });

  it('shows ink icon buttons on desktop instead of chips', () => {
    render(<BrowseToolbar {...defaultProps({inkFilters: ['Amethyst'] as Ink[]})} />);

    expect(screen.getByRole('button', {name: 'Filter by Amethyst'})).toBeInTheDocument();
    // Ink chip text should not appear on desktop
    expect(screen.queryByText('Amethyst')).not.toBeInTheDocument();
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

  it('renders selected costs as one combined chip on mobile, sorted, clearing all on dismiss', () => {
    const onClearCosts = vi.fn();
    render(
      <BrowseToolbar {...defaultProps({costFilters: [5, 3], onClearCosts, isMobile: true})} />,
    );

    const chip = screen.getByText('Costs: 3, 5');
    expect(chip).toBeInTheDocument();

    fireEvent.click(chip);
    expect(onClearCosts).toHaveBeenCalledOnce();
  });

  it('uses singular "Cost:" label for a single selected cost', () => {
    render(<BrowseToolbar {...defaultProps({costFilters: [3], isMobile: true})} />);
    expect(screen.getByText('Cost: 3')).toBeInTheDocument();
  });

  it('shows inline cost icons (not a chip) on wide desktop', () => {
    setViewport(1600);
    render(<BrowseToolbar {...defaultProps({costFilters: [3]})} />);

    expect(screen.getByRole('button', {name: 'Cost 3'})).toBeInTheDocument();
    expect(screen.queryByText('Cost: 3')).not.toBeInTheDocument();
  });

  it('tucks cost into a combined chip on narrow desktop (no inline cost icons)', () => {
    setViewport(1280);
    const onClearCosts = vi.fn();
    render(<BrowseToolbar {...defaultProps({costFilters: [3, 5], onClearCosts})} />);

    expect(screen.queryByRole('button', {name: 'Cost 3'})).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Costs: 3, 5'));
    expect(onClearCosts).toHaveBeenCalledOnce();
  });

  it('keeps ink and inkwell inline on desktop without a chip (only cost tucks)', () => {
    setViewport(1280);
    render(
      <BrowseToolbar
        {...defaultProps({
          inkFilters: ['Amber'] as Ink[],
          filters: {inkwell: 'inkable'} as CardFilterOptions,
        })}
      />,
    );

    expect(screen.getByRole('button', {name: 'Filter by Amber'})).toBeInTheDocument();
    expect(screen.queryByText('Inkable')).not.toBeInTheDocument();
  });

  it('renders sort select on both desktop and mobile', () => {
    const {unmount} = render(<BrowseToolbar {...defaultProps({isMobile: false})} />);
    expect(screen.getByRole('combobox', {name: 'Sort cards'})).toBeInTheDocument();
    unmount();

    render(<BrowseToolbar {...defaultProps({isMobile: true})} />);
    expect(screen.getByRole('combobox', {name: 'Sort cards'})).toBeInTheDocument();
  });

  it('fires onSortChange when sort is changed', () => {
    const onSortChange = vi.fn();
    render(<BrowseToolbar {...defaultProps({onSortChange})} />);

    fireEvent.change(screen.getByRole('combobox', {name: 'Sort cards'}), {
      target: {value: 'name-asc'},
    });

    expect(onSortChange).toHaveBeenCalledWith('name-asc');
  });

  it('renders extraChips content when provided', () => {
    render(
      <BrowseToolbar
        {...defaultProps({extraChips: <span data-testid="role-chip">Enabler</span>})}
      />,
    );
    expect(screen.getByTestId('role-chip')).toHaveTextContent('Enabler');
  });

  it('does not render extra content when extraChips is undefined', () => {
    render(<BrowseToolbar {...defaultProps()} />);
    expect(screen.queryByTestId('role-chip')).not.toBeInTheDocument();
  });
});
