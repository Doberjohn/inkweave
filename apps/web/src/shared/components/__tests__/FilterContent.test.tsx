import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {FilterContent} from '../FilterContent';
import type {Ink} from '../../../features/cards';
import type {CardFilterOptions} from '../../../features/cards';
import type {CardTypeFilter} from '../../constants';

function defaultProps(overrides = {}) {
  return {
    inkFilters: [] as Ink[],
    typeFilters: [] as CardTypeFilter[],
    costFilters: [] as number[],
    filters: {} as CardFilterOptions,
    uniqueKeywords: [],
    uniqueClassifications: [],
    sets: [],
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onFiltersChange: vi.fn(),
    variant: 'desktop' as const,
    ...overrides,
  };
}

describe('FilterContent cost section', () => {
  it('hides the Ink Cost section on desktop when cost icons are inline', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop', showInlineCost: true})} />);
    expect(screen.queryByText('Ink Cost')).not.toBeInTheDocument();
  });

  it('shows the Ink Cost section on desktop when cost icons are tucked away', () => {
    render(<FilterContent {...defaultProps({variant: 'desktop', showInlineCost: false})} />);
    expect(screen.getByText('Ink Cost')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cost 3'})).toBeInTheDocument();
  });

  it('always shows the Ink Cost section on mobile', () => {
    render(<FilterContent {...defaultProps({variant: 'mobile', showInlineCost: true})} />);
    expect(screen.getByText('Ink Cost')).toBeInTheDocument();
  });
});
