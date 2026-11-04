import {useState} from 'react';
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

/** The panel as the page drives it: clearing drops the count to 0, which takes Clear all away. */
function LivePanel() {
  const [count, setCount] = useState(1);
  return <BrowseSidePanel filterProps={filterProps} activeFilterCount={count} onClearFilters={() => setCount(0)} />;
}

describe('BrowseSidePanel', () => {
  it('keeps focus in the panel when Clear all clears, and so removes, itself', () => {
    render(<LivePanel />);
    const clearAll = screen.getByRole('button', {name: 'Clear all'});
    clearAll.focus();
    fireEvent.click(clearAll);
    expect(screen.queryByRole('button', {name: 'Clear all'})).not.toBeInTheDocument();
    expect(screen.getByRole('complementary', {name: 'Filters'})).toHaveFocus();
  });

  it('pins its foot to the bottom after the filters, which stay where they were', () => {
    const {rerender} = render(<BrowseSidePanel filterProps={filterProps} activeFilterCount={1} onClearFilters={vi.fn()} />);
    const panel = screen.getByRole('complementary', {name: 'Filters'});
    const filters = panel.firstElementChild;

    rerender(
      <BrowseSidePanel
        filterProps={filterProps}
        activeFilterCount={1}
        onClearFilters={vi.fn()}
        foot={<button type="button">Save as a binder</button>}
      />,
    );

    const strip = screen.getByRole('button', {name: 'Save as a binder'}).parentElement as HTMLElement;
    expect(panel.firstElementChild).toBe(filters);
    expect(panel.lastElementChild).toBe(strip);
    expect(strip.style.position).toBe('sticky');
    expect(strip.style.bottom).toBe('0px');
  });
});
