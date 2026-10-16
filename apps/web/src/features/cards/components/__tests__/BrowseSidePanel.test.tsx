import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import type {Ink} from 'inkweave-synergy-engine';
import type {CardFilterOptions} from '../../loader';
import type {CardTypeFilter} from '../../../../shared/constants';
import {BrowseSidePanel} from '../BrowseSidePanel';

const filterProps = {
  inkFilters: ['Amber'] as Ink[],
  typeFilters: [] as CardTypeFilter[],
  costFilters: [] as number[],
  filters: {} as CardFilterOptions,
  uniqueKeywords: [],
  uniqueClassifications: [],
  uniqueRarities: [] as string[],
  sets: [],
  onToggleInk: vi.fn(),
  onToggleType: vi.fn(),
  onToggleCost: vi.fn(),
  onFiltersChange: vi.fn(),
};

describe('BrowseSidePanel', () => {
  it('keeps focus in the panel when Clear all clears, and so removes, itself', () => {
    const onClearFilters = vi.fn();
    render(
      <BrowseSidePanel
        filterProps={filterProps}
        activeFilterCount={1}
        onClearFilters={onClearFilters}
      />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Clear all'}));
    expect(onClearFilters).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('complementary', {name: 'Filters'})).toHaveFocus();
  });
});
