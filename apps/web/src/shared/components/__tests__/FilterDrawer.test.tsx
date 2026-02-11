import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FilterDrawer} from '../FilterDrawer';

describe('FilterDrawer', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inkFilters: [] as string[],
    typeFilters: [] as string[],
    costFilters: [] as number[],
    filters: {},
    activeFilterCount: 0,
    uniqueKeywords: ['Singer', 'Evasive', 'Ward'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '5', name: 'Shimmering Skies', number: 5},
      {code: '10', name: 'Set Ten', number: 10},
    ],
    onToggleInk: vi.fn(),
    onToggleType: vi.fn(),
    onToggleCost: vi.fn(),
    onFiltersChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  it('should not render when closed', () => {
    render(<FilterDrawer {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render filter title when open', () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole('heading', {name: /filters/i})).toBeInTheDocument();
  });

  it('should render all ink filter buttons', () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole('button', {name: /amber/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /amethyst/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /emerald/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /ruby/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /sapphire/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /steel/i})).toBeInTheDocument();
  });

  it('should render card type filter buttons', () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.getByRole('button', {name: /character/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /action/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /item/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /location/i})).toBeInTheDocument();
  });

  it('should call onToggleInk when clicking ink button', () => {
    const onToggleInk = vi.fn();
    render(<FilterDrawer {...defaultProps} onToggleInk={onToggleInk} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));

    expect(onToggleInk).toHaveBeenCalledWith('Amber');
  });

  it('should call onClose when clicking Apply button', () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /close filters/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
  });

  it('should show Clear all button when filters are active', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} activeFilterCount={1} />);

    expect(screen.getByRole('button', {name: /clear all/i})).toBeInTheDocument();
  });

  it('should not show Clear all button when no filters are active', () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.queryByRole('button', {name: /clear all/i})).not.toBeInTheDocument();
  });

  it('should call onClearAll when clicking Clear all', () => {
    const onClearAll = vi.fn();
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} activeFilterCount={1} onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole('button', {name: /clear all/i}));

    expect(onClearAll).toHaveBeenCalled();
  });

  it('should show active filter count in title', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} typeFilters={['Character']} activeFilterCount={2} />);

    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it('should mark current ink as active', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Ruby']} activeFilterCount={1} />);

    expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should call onToggleType when selecting card type', () => {
    const onToggleType = vi.fn();
    render(<FilterDrawer {...defaultProps} onToggleType={onToggleType} />);

    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    expect(onToggleType).toHaveBeenCalledWith('Character');
  });

  it('should close on Enter or Space key on backdrop', () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByRole('button', {name: /close filters/i});

    fireEvent.keyDown(backdrop, {key: 'Enter'});
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(backdrop, {key: ' '});
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should call onToggleCost when clicking cost button', () => {
    const onToggleCost = vi.fn();
    render(<FilterDrawer {...defaultProps} onToggleCost={onToggleCost} />);

    const buttons = screen.getAllByRole('button');
    const cost3Button = buttons.find((b) => b.textContent?.includes('3') && !b.textContent?.includes('Filter'));
    fireEvent.click(cost3Button!);

    expect(onToggleCost).toHaveBeenCalledWith(3);
  });

  it('should call onFiltersChange when selecting keyword', () => {
    const onFiltersChange = vi.fn();
    render(<FilterDrawer {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0]; // First select is keyword

    fireEvent.change(keywordSelect, {target: {value: 'Singer'}});

    expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Singer']});
  });

  it('should clear keywords when selecting empty option', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterDrawer
        {...defaultProps}
        filters={{keywords: ['Singer']}}
        onFiltersChange={onFiltersChange}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0];

    fireEvent.change(keywordSelect, {target: {value: ''}});

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should call onFiltersChange when selecting classification', () => {
    const onFiltersChange = vi.fn();
    render(<FilterDrawer {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const classificationSelect = selects[1]; // Second select is classification

    fireEvent.change(classificationSelect, {target: {value: 'Princess'}});

    expect(onFiltersChange).toHaveBeenCalledWith({classifications: ['Princess']});
  });

  it('should call onFiltersChange when selecting set', () => {
    const onFiltersChange = vi.fn();
    render(<FilterDrawer {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const setSelect = selects[2]; // Third select is set

    fireEvent.change(setSelect, {target: {value: '5'}});

    expect(onFiltersChange).toHaveBeenCalledWith({setCode: '5'});
  });

  it('should clear setCode when selecting empty option', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterDrawer {...defaultProps} filters={{setCode: '5'}} onFiltersChange={onFiltersChange} />,
    );

    const selects = screen.getAllByRole('combobox');
    const setSelect = selects[2];

    fireEvent.change(setSelect, {target: {value: ''}});

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should show selected keyword value in dropdown', () => {
    render(<FilterDrawer {...defaultProps} filters={{keywords: ['Evasive']}} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0] as HTMLSelectElement;

    expect(keywordSelect.value).toBe('Evasive');
  });

  it('should count all active filters correctly', () => {
    render(
      <FilterDrawer
        {...defaultProps}
        inkFilters={['Amber']}
        typeFilters={['Character']}
        costFilters={[2, 5]}
        activeFilterCount={7}
        filters={{
          keywords: ['Singer'],
          classifications: ['Princess'],
          setCode: '5',
        }}
      />,
    );

    // 7 filters: 1 ink + 1 type + 2 costs + keywords, classifications, setCode
    expect(screen.getByText(/filters \(7\)/i)).toBeInTheDocument();
  });
});
