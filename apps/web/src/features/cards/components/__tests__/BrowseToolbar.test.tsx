import {describe, it, expect, vi, afterEach} from 'vitest';
import {render, screen, fireEvent, within} from '@testing-library/react';
import {BrowseToolbar} from '../BrowseToolbar';
import {BINDER_SORT_OPTIONS} from '../../../collection/binderCards';
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

    const filtersBtn = screen.getByRole('button', {name: 'Filters, 3 on'});
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

  it('renders one chip per picked keyword, and dismissing one keeps the rest', () => {
    const onFiltersChange = vi.fn();
    render(<BrowseToolbar {...defaultProps({filters: {keywords: ['Evasive', 'Ward']}, onFiltersChange})} />);

    expect(screen.getByText('Evasive')).toBeInTheDocument();
    expect(screen.getByText('Ward')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Evasive'));
    expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Ward']});
  });

  it('shows a whole kind of rarities as one chip named for its preset, which clears them all', () => {
    const onFiltersChange = vi.fn();
    const filters = {rarities: ['Iconic', 'Special', 'Epic', 'Enchanted']};
    render(<BrowseToolbar {...defaultProps({filters, onFiltersChange})} />);
    expect(screen.queryByText('Epic')).toBeNull();
    fireEvent.click(screen.getByText('Alt art cards'));
    expect(onFiltersChange).toHaveBeenCalledWith({rarities: undefined});
  });

  it('names the kind by the rarities the page offers, as the panel picks it: no promo in collection mode', () => {
    const rarities = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary', 'Epic', 'Enchanted', 'Iconic'];
    render(<BrowseToolbar {...defaultProps({filters: {rarities: ['Iconic', 'Epic', 'Enchanted']}, rarities})} />);
    expect(screen.getByText('Alt art cards')).toBeInTheDocument();
    expect(screen.queryByText('Epic')).toBeNull();
  });

  it("names a picked Special rarity's chip Promo, as the Rarity filter does (#805)", () => {
    const onFiltersChange = vi.fn();
    render(<BrowseToolbar {...defaultProps({filters: {rarities: ['Legendary', 'Special']}, onFiltersChange})} />);
    expect(screen.queryByText('Special')).toBeNull();
    fireEvent.click(screen.getByText('Promo'));
    expect(onFiltersChange).toHaveBeenCalledWith({rarities: ['Legendary']});
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

  it('keeps every inline ink, cost and inkwell icon, with those outside buttonOptions off', () => {
    setViewport(1600);
    const buttonOptions = {
      inks: ['Ruby'] as Ink[],
      costs: [4],
      types: ['Character'] as CardTypeFilter[],
      inkwell: ['uninkable'] as const,
    };
    render(<BrowseToolbar {...defaultProps({buttonOptions})} />);

    /** The names of a group's buttons that can be pressed. */
    const enabledIn = (group: string) =>
      within(screen.getByRole('group', {name: group}))
        .getAllByRole('button')
        .filter((button) => !(button as HTMLButtonElement).disabled)
        .map((button) => button.getAttribute('aria-label'));
    const countIn = (group: string) => within(screen.getByRole('group', {name: group})).getAllByRole('button').length;

    expect(countIn('Ink color filters')).toBe(6);
    expect(enabledIn('Ink color filters')).toEqual(['Filter by Ruby']);
    expect(countIn('Ink cost filters')).toBe(9);
    expect(enabledIn('Ink cost filters')).toEqual(['Cost 4']);
    expect(countIn('Inkwell filters')).toBe(2);
    expect(enabledIn('Inkwell filters')).toEqual(['Filter by Uninkable']);
  });
});

// Browse's own toolbar (owner, 2026-10-08): Collection at the far end, the sort beside
// Filters, and on desktop a toolbar docked over the side panel.
describe('BrowseToolbar on Browse', () => {
  const docked = (panelOpen: boolean) => ({docked: {panelOpen}});
  const search = {searchQuery: '', onSearchChange: vi.fn()};
  const modeSwitch = <button type="button">Collection</button>;
  /** The toolbar's controls in document order, by name. */
  const order = () =>
    [...screen.getByTestId('browse-toolbar').querySelectorAll('button, select, input')].map(
      (el) => el.getAttribute('aria-label') ?? el.textContent?.trim(),
    );

  it('puts the sort beside Filters and the mode switch at the far end', () => {
    render(<BrowseToolbar {...defaultProps({...search, modeSwitch, ...docked(true)})} />);
    expect(order()).toEqual(['Filters', 'Sort cards', 'Search cards', 'Collection']);
  });

  it("puts collection mode's set picker just before the mode switch, which keeps its place", () => {
    const setPicker = <button type="button">Binder set</button>;
    render(<BrowseToolbar {...defaultProps({...search, modeSwitch, setPicker, ...docked(true)})} />);
    expect(order()).toEqual(['Filters', 'Sort cards', 'Search cards', 'Binder set', 'Collection']);
  });

  it("puts the collection's actions after the mode switch, docked or flowing, but not on phones (owner, 2026-10-20)", () => {
    const modeActions = <button type="button">Collection actions</button>;
    const {unmount} = render(<BrowseToolbar {...defaultProps({...search, modeSwitch, modeActions, ...docked(true)})} />);
    expect(order().slice(-2)).toEqual(['Collection', 'Collection actions']);
    unmount();
    const tablet = render(<BrowseToolbar {...defaultProps({...search, modeSwitch, modeActions})} />);
    expect(order().slice(-2)).toEqual(['Collection', 'Collection actions']);
    tablet.unmount();
    render(<BrowseToolbar {...defaultProps({...search, modeSwitch, modeActions, isMobile: true})} />);
    expect(order().at(-1)).toBe('Collection');
  });

  it('keeps the sort at the far end of a toolbar without a mode switch (the playstyle page)', () => {
    render(<BrowseToolbar {...defaultProps(search)} />);
    expect(order().at(-1)).toBe('Sort cards');
  });

  it("puts a phone's chips under its row with Collection, and before the far end elsewhere", () => {
    const filtered = {...search, typeFilters: ['Character'] as CardTypeFilter[]};
    const chipIndex = () => order().findIndex((name) => name?.includes('Character'));
    const phone = render(<BrowseToolbar {...defaultProps({...filtered, modeSwitch, isMobile: true})} />);
    expect(chipIndex()).toBe(order().indexOf('Collection') + 1);
    phone.unmount();

    const tablet = render(<BrowseToolbar {...defaultProps({...filtered, modeSwitch})} />);
    expect(chipIndex()).toBeLessThan(order().indexOf('Collection'));
    tablet.unmount();

    render(<BrowseToolbar {...defaultProps({...filtered, isMobile: true})} />);
    expect(chipIndex()).toBeLessThan(order().indexOf('Sort cards'));
  });

  it("lets the sort take what Filters and Collection leave in a phone's row, as the binder's set button does", () => {
    const sort = () => screen.getByRole('combobox', {name: 'Sort cards'});
    const phone = render(<BrowseToolbar {...defaultProps({...search, modeSwitch, isMobile: true})} />);
    expect(sort().style).toMatchObject({flexGrow: '1', minWidth: '0px', textOverflow: 'ellipsis'});
    phone.unmount();

    const tablet = render(<BrowseToolbar {...defaultProps({...search, modeSwitch})} />);
    expect(sort().style.flexGrow).toBe('');
    tablet.unmount();

    const noSwitch = render(<BrowseToolbar {...defaultProps({...search, isMobile: true})} />);
    expect(sort().style.flexGrow).toBe('');
    noSwitch.unmount();

    // A slot a caller fills with `{flag && <Switch />}` holds no Collection either.
    render(<BrowseToolbar {...defaultProps({...search, modeSwitch: false, isMobile: true})} />);
    expect(sort().style.flexGrow).toBe('');
  });

  it('fills Filters while the docked panel is open, and outlines it while closed', () => {
    const {rerender} = render(<BrowseToolbar {...defaultProps(docked(true))} />);
    const filters = () => screen.getByRole('button', {name: 'Filters'});
    expect(filters()).toHaveAttribute('aria-expanded', 'true');
    expect(filters().style.background).toContain('gradient');

    rerender(<BrowseToolbar {...defaultProps(docked(false))} />);
    expect(filters()).toHaveAttribute('aria-expanded', 'false');
    expect(filters().style.background).toBe('transparent');
  });

  it('offers the sort options the page passes, so collection mode names its default Collector number', () => {
    render(<BrowseToolbar {...defaultProps({sortOptions: BINDER_SORT_OPTIONS, ...docked(true)})} />);
    expect(screen.getByRole('combobox', {name: 'Sort cards'})).toHaveDisplayValue('Collector number');
  });

  it('shows the active filters as chips only while the docked panel is closed', () => {
    const props = defaultProps({typeFilters: ['Character'] as CardTypeFilter[]});
    const {rerender} = render(<BrowseToolbar {...props} {...docked(false)} />);
    expect(screen.getByRole('button', {name: /Character/})).toBeInTheDocument();

    rerender(<BrowseToolbar {...props} {...docked(true)} />);
    expect(screen.queryByRole('button', {name: /Character/})).toBeNull();
  });

  it("ends at its controls on Browse, whose grid keeps that room for a card's glow, and not on the playstyle page", () => {
    const toolbar = () => screen.getByTestId('browse-toolbar');
    const {rerender} = render(<BrowseToolbar {...defaultProps({flushBottom: true})} />);
    expect(toolbar().style.paddingBottom).toBe('0px');

    rerender(<BrowseToolbar {...defaultProps({flushBottom: true, ...docked(true)})} />);
    expect(toolbar().style.paddingBottom).toBe('0px');

    rerender(<BrowseToolbar {...defaultProps({isMobile: true})} />);
    expect(toolbar().style.paddingBottom).toBe('12px');
  });

  it("keeps 8px under its controls on a phone's Browse, so scrolled cards stop short of them (owner, 2026-10-26)", () => {
    render(<BrowseToolbar {...defaultProps({flushBottom: true, isMobile: true})} />);
    expect(screen.getByTestId('browse-toolbar').style.paddingBottom).toBe('8px');
  });
});

// The clear button at the search field's right end (owner, 2026-10-22).
describe('BrowseToolbar search', () => {
  it('offers the clear button only while the search holds text', () => {
    const {rerender} = render(<BrowseToolbar {...defaultProps({searchQuery: '', onSearchChange: vi.fn()})} />);
    expect(screen.queryByRole('button', {name: 'Clear search'})).toBeNull();

    rerender(<BrowseToolbar {...defaultProps({searchQuery: 'elsa', onSearchChange: vi.fn()})} />);
    expect(screen.getByRole('button', {name: 'Clear search'})).toBeInTheDocument();
  });

  it('empties the search and leaves the focus in the field for the next one', () => {
    const onSearchChange = vi.fn();
    render(<BrowseToolbar {...defaultProps({searchQuery: 'elsa', onSearchChange})} />);

    fireEvent.click(screen.getByRole('button', {name: 'Clear search'}));

    expect(onSearchChange).toHaveBeenCalledWith('');
    expect(screen.getByTestId('browse-search')).toHaveFocus();
  });
});
