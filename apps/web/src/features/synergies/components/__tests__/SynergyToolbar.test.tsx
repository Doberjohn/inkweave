import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {SynergyToolbar} from '../SynergyToolbar';
import {EMPTY_SYNERGY_FILTERS, type SynergyFilterState} from '../../utils/filterSynergyCards';

// The dialog decides cost from window.innerWidth (useInlineCostFilters); jsdom
// defaults to 1024, under the 1580 line where the old modal began hiding cost.
afterEach(() => {
  vi.unstubAllGlobals();
});

function renderToolbar(filterState: Partial<SynergyFilterState> = {}, onFilterChange = vi.fn()) {
  render(
    <SynergyToolbar
      filterState={{...EMPTY_SYNERGY_FILTERS, ...filterState}}
      onFilterChange={onFilterChange}
      sortOrder="ink-cost"
      onSortChange={vi.fn()}
      isMobile={false}
      uniqueKeywords={[]}
      uniqueClassifications={[]}
      uniqueRarities={[]}
      sets={[]}
    />,
  );
  return onFilterChange;
}

describe('SynergyToolbar', () => {
  it('offers Inkwell and Ink Cost in the desktop dialog, even on wide screens', () => {
    // At 1580px and up the dialog used to drop cost, assuming inline cost buttons
    // this toolbar does not have; it never offered inkwell on desktop at all.
    vi.stubGlobal('innerWidth', 1700);
    renderToolbar();
    fireEvent.click(screen.getByRole('button', {name: 'Filters'}));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Inkwell')).toBeInTheDocument();
    expect(within(dialog).getByText('Ink Cost')).toBeInTheDocument();
  });

  it('shows an active inkwell filter as a chip that clears it', () => {
    const onFilterChange = renderToolbar({filters: {inkwell: 'uninkable'}});
    fireEvent.click(screen.getByRole('button', {name: /Uninkable/}));
    const next = onFilterChange.mock.calls[0][0]({...EMPTY_SYNERGY_FILTERS, filters: {inkwell: 'uninkable'}});
    expect(next.filters.inkwell).toBeUndefined();
  });

  it('shows the Dual-ink cards mode as a chip while the inks offer it', () => {
    renderToolbar({inkFilters: ['Amber'], filters: {inkMatch: 'dual'}});
    expect(screen.getByRole('button', {name: /Dual-ink cards/})).toBeInTheDocument();
  });

  it('counts an active inkwell filter on the Filters button', () => {
    renderToolbar({filters: {inkwell: 'inkable'}});
    expect(screen.getByRole('button', {name: 'Filters, 1 on'})).toHaveTextContent('1');
  });
});
