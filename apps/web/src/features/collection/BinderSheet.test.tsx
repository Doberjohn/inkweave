import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, within} from '@testing-library/react';
import type {BrowseSortOrder} from '../../shared/constants';
import type {AlsoWrite, FilterDraft} from '../../shared/hooks/useFilterParams';
import {BinderSheet} from './BinderSheet';
import type {BinderShow} from './binderCards';

interface Opening {
  isOpen?: boolean;
  show?: BinderShow;
  sortOrder?: BrowseSortOrder;
}

function newCalls() {
  return {onApply: vi.fn<(draft: FilterDraft, also: AlsoWrite) => void>(), onClose: vi.fn<() => void>()};
}

function sheet({isOpen = true, show = 'all', sortOrder = 'newest'}: Opening, calls: ReturnType<typeof newCalls>) {
  return (
    <BinderSheet
      isOpen={isOpen}
      onClose={calls.onClose}
      onApply={calls.onApply}
      show={show}
      sortOrder={sortOrder}
      inkFilters={[]}
      typeFilters={[]}
      costFilters={[]}
      filters={{}}
      uniqueKeywords={[]}
      uniqueClassifications={[]}
      uniqueRarities={['Common']}
      sets={[]}
    />
  );
}

function renderSheet(opening: Opening = {}) {
  const calls = newCalls();
  const view = render(sheet(opening, calls));
  return {...calls, rerender: (next: Opening) => view.rerender(sheet({...opening, ...next}, calls))};
}

const shows = () => within(screen.getByRole('group', {name: 'Binder shows'}));
const pressed = () => shows().getByRole('button', {pressed: true});
const sort = () => screen.getByRole('combobox', {name: 'Sort cards'});
const press = (name: string | RegExp) => fireEvent.click(screen.getByRole('button', {name}));

/** What Apply's one write did to the URL's params, from `owned=owned`. */
function written(also: AlsoWrite): string {
  const params = new URLSearchParams('owned=owned');
  also.edit?.(params);
  return params.toString();
}

describe('BinderSheet (#969)', () => {
  it('is titled Binder, with Show and the sort above the filters, and nothing after them', () => {
    renderSheet();
    expect(screen.getByRole('heading', {name: 'Binder'})).toBeInTheDocument();
    const order = [
      screen.getByRole('group', {name: 'Binder shows'}),
      sort(),
      // Folded, as in every phone sheet (owner, 2026-10-26).
      screen.getByRole('button', {name: /^Type/, expanded: false}),
    ];
    order.slice(1).forEach((after, i) => {
      expect(order[i].compareDocumentPosition(after) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });
    // The numbers are on the binder's inside cover (owner, 2026-10-27).
    expect(screen.queryByText('Progress')).not.toBeInTheDocument();
    expect(screen.queryByRole('region', {name: 'Collection numbers'})).not.toBeInTheDocument();
  });

  it("starts from what the binder shows and its sort, and changes neither before Apply", () => {
    const {onApply} = renderSheet({show: 'owned', sortOrder: 'cost-desc'});
    expect(pressed()).toHaveTextContent('Owned');
    expect(sort()).toHaveValue('cost-desc');

    press('Missing');
    fireEvent.change(sort(), {target: {value: 'name-asc'}});

    expect(pressed()).toHaveTextContent('Missing');
    expect(sort()).toHaveValue('name-asc');
    expect(onApply).not.toHaveBeenCalled();
  });

  it('applies the filters, the sort and Show in one call, then closes', () => {
    const {onApply, onClose} = renderSheet();
    press('Missing');
    fireEvent.change(sort(), {target: {value: 'name-asc'}});
    press(/amber/i);

    press('Apply');

    expect(onApply).toHaveBeenCalledOnce();
    const [draft, also] = onApply.mock.calls[0];
    expect(draft).toEqual({inks: ['Amber'], types: [], costs: [], opts: {}});
    expect(also.sortOrder).toBe('name-asc');
    expect(written(also)).toBe('owned=missing');
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('writes All by leaving the param out', () => {
    const {onApply} = renderSheet({show: 'owned'});
    press('All');
    press('Apply');
    expect(written(onApply.mock.calls[0][1])).toBe('');
  });

  it("drops its drafts when it closes: opened again, it starts from the binder's", () => {
    const {rerender} = renderSheet({show: 'owned', sortOrder: 'cost-desc'});
    press('Missing');
    fireEvent.change(sort(), {target: {value: 'name-asc'}});

    rerender({isOpen: false});
    rerender({isOpen: true});

    expect(pressed()).toHaveTextContent('Owned');
    expect(sort()).toHaveValue('cost-desc');
  });

  it('shows Clear all for Show alone, which puts back All with the filters and leaves the sort', () => {
    const {onApply} = renderSheet({show: 'missing', sortOrder: 'cost-desc'});
    // No filter on yet: Show alone shows it.
    const clear = screen.getByRole('button', {name: /clear all/i});
    press(/amber/i);

    fireEvent.click(clear);

    expect(pressed()).toHaveTextContent('All');
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
    expect(sort()).toHaveValue('cost-desc');
    expect(screen.queryByRole('button', {name: /clear all/i})).toBeNull();
    press('Apply');
    expect(onApply.mock.calls[0][1].sortOrder).toBe('cost-desc');
  });
});
