import {describe, it, expect, vi} from 'vitest';
import {render, screen, within} from '@testing-library/react';
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

describe('FilterContent button options', () => {
  it('offers only the values in buttonOptions', () => {
    const buttonOptions = {
      inks: ['Ruby'] as Ink[],
      costs: [2, 9],
      types: ['Song'] as CardTypeFilter[],
      inkwell: ['inkable'] as const,
    };
    render(<FilterContent {...defaultProps({variant: 'mobile', buttonOptions})} />);

    // Icon buttons are named by aria-label, text buttons by their text.
    const buttonNames = (group: string) =>
      within(screen.getByRole('group', {name: group}))
        .getAllByRole('button')
        .map((button) => button.getAttribute('aria-label') ?? button.textContent);
    expect(buttonNames('Ink color filters')).toEqual(['Filter by Ruby']);
    expect(buttonNames('Ink cost filters')).toEqual(['Cost 2', 'Cost 9+']);
    expect(buttonNames('Card type filters')).toEqual(['Song']);
    expect(buttonNames('Inkwell filters')).toEqual(['Inkable']);
  });

  it('leaves out a dropdown with no options', () => {
    render(<FilterContent {...defaultProps({uniqueClassifications: ['Hero']})} />);

    expect(screen.queryByRole('combobox', {name: 'Filter by keyword'})).not.toBeInTheDocument();
    expect(screen.getByRole('combobox', {name: 'Filter by classification'})).toBeInTheDocument();
  });
});
