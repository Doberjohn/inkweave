import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {FilterModal} from '../FilterModal';

describe('FilterModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    inkFilter: 'all' as const,
    filters: {},
    uniqueKeywords: ['Singer', 'Evasive', 'Ward'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '5', name: 'Shimmering Skies', number: 5},
      {code: '10', name: 'Set Ten', number: 10},
    ],
    onInkFilterChange: vi.fn(),
    onFiltersChange: vi.fn(),
    onClearAll: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should not render when closed', () => {
    render(<FilterModal {...defaultProps} isOpen={false} />);

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render filter title when open', () => {
    render(<FilterModal {...defaultProps} />);

    expect(screen.getByRole('heading', {name: /filters/i})).toBeInTheDocument();
  });

  it('should render all ink filter buttons', () => {
    render(<FilterModal {...defaultProps} />);

    // Two "All" buttons exist (one for Ink, one for Type)
    const allButtons = screen.getAllByRole('button', {name: /^all$/i});
    expect(allButtons.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByRole('button', {name: /amber/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /amethyst/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /emerald/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /ruby/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /sapphire/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /steel/i})).toBeInTheDocument();
  });

  it('should render card type filter buttons', () => {
    render(<FilterModal {...defaultProps} />);

    expect(screen.getByRole('button', {name: /character/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /action/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /item/i})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /location/i})).toBeInTheDocument();
  });

  it('should call onInkFilterChange when clicking ink button', () => {
    const onInkFilterChange = vi.fn();
    render(<FilterModal {...defaultProps} onInkFilterChange={onInkFilterChange} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));

    expect(onInkFilterChange).toHaveBeenCalledWith('Amber');
  });

  it('should call onClose when clicking Apply button', () => {
    const onClose = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop', () => {
    const onClose = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId('filter-modal-backdrop');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} />);

    fireEvent.keyDown(document, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
  });

  it('should show Clear all button when filters are active', () => {
    render(<FilterModal {...defaultProps} inkFilter="Amber" />);

    expect(screen.getByRole('button', {name: /clear all/i})).toBeInTheDocument();
  });

  it('should not show Clear all button when no filters are active', () => {
    render(<FilterModal {...defaultProps} />);

    expect(screen.queryByRole('button', {name: /clear all/i})).not.toBeInTheDocument();
  });

  it('should call onClearAll when clicking Clear all', () => {
    const onClearAll = vi.fn();
    render(<FilterModal {...defaultProps} inkFilter="Amber" onClearAll={onClearAll} />);

    fireEvent.click(screen.getByRole('button', {name: /clear all/i}));

    expect(onClearAll).toHaveBeenCalled();
  });

  it('should show active filter count in title', () => {
    render(<FilterModal {...defaultProps} inkFilter="Amber" filters={{type: 'Character'}} />);

    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it('should mark current ink as active', () => {
    render(<FilterModal {...defaultProps} inkFilter="Ruby" />);

    expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    // The first "All" button (Ink filter) should not be pressed when Ruby is selected
    const allButtons = screen.getAllByRole('button', {name: /^all$/i});
    expect(allButtons[0]).toHaveAttribute('aria-pressed', 'false');
  });

  it('should call onFiltersChange when selecting card type', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    expect(onFiltersChange).toHaveBeenCalledWith({type: 'Character'});
  });

  it('should call onFiltersChange to clear type when clicking All in Type section', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal
        {...defaultProps}
        filters={{type: 'Character'}}
        onFiltersChange={onFiltersChange}
      />,
    );

    // Find the Type section's All button (second All button)
    const allButtons = screen.getAllByRole('button', {name: /^all$/i});
    fireEvent.click(allButtons[1]); // Second All is for Type

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should close on Enter or Space key on backdrop', () => {
    const onClose = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} />);

    const backdrop = screen.getByTestId('filter-modal-backdrop');

    fireEvent.keyDown(backdrop, {key: 'Enter'});
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(backdrop, {key: ' '});
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('should call onFiltersChange when selecting min cost', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const minCostSelect = selects[0]; // First select is min cost

    fireEvent.change(minCostSelect, {target: {value: '3'}});

    expect(onFiltersChange).toHaveBeenCalledWith({minCost: 3});
  });

  it('should call onFiltersChange when selecting max cost', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const maxCostSelect = selects[1]; // Second select is max cost

    fireEvent.change(maxCostSelect, {target: {value: '7'}});

    expect(onFiltersChange).toHaveBeenCalledWith({maxCost: 7});
  });

  it('should clear minCost when selecting empty option', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal {...defaultProps} filters={{minCost: 3}} onFiltersChange={onFiltersChange} />,
    );

    const selects = screen.getAllByRole('combobox');
    const minCostSelect = selects[0];

    fireEvent.change(minCostSelect, {target: {value: ''}});

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should call onFiltersChange when selecting keyword', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[2]; // Third select is keyword

    fireEvent.change(keywordSelect, {target: {value: 'Singer'}});

    expect(onFiltersChange).toHaveBeenCalledWith({keywords: ['Singer']});
  });

  it('should clear keywords when selecting empty option', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal
        {...defaultProps}
        filters={{keywords: ['Singer']}}
        onFiltersChange={onFiltersChange}
      />,
    );

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[2];

    fireEvent.change(keywordSelect, {target: {value: ''}});

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should call onFiltersChange when selecting classification', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const classificationSelect = selects[3]; // Fourth select is classification

    fireEvent.change(classificationSelect, {target: {value: 'Princess'}});

    expect(onFiltersChange).toHaveBeenCalledWith({classifications: ['Princess']});
  });

  it('should call onFiltersChange when selecting set', () => {
    const onFiltersChange = vi.fn();
    render(<FilterModal {...defaultProps} onFiltersChange={onFiltersChange} />);

    const selects = screen.getAllByRole('combobox');
    const setSelect = selects[4]; // Fifth select is set

    fireEvent.change(setSelect, {target: {value: '5'}});

    expect(onFiltersChange).toHaveBeenCalledWith({setCode: '5'});
  });

  it('should clear setCode when selecting empty option', () => {
    const onFiltersChange = vi.fn();
    render(
      <FilterModal {...defaultProps} filters={{setCode: '5'}} onFiltersChange={onFiltersChange} />,
    );

    const selects = screen.getAllByRole('combobox');
    const setSelect = selects[4];

    fireEvent.change(setSelect, {target: {value: ''}});

    expect(onFiltersChange).toHaveBeenCalledWith({});
  });

  it('should show selected keyword value in dropdown', () => {
    render(<FilterModal {...defaultProps} filters={{keywords: ['Evasive']}} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[2] as HTMLSelectElement;

    expect(keywordSelect.value).toBe('Evasive');
  });

  it('should count all active filters correctly', () => {
    render(
      <FilterModal
        {...defaultProps}
        inkFilter="Amber"
        filters={{
          type: 'Character',
          minCost: 2,
          maxCost: 5,
          keywords: ['Singer'],
          classifications: ['Princess'],
          setCode: '5',
        }}
      />,
    );

    // 7 filters: ink, type, minCost, maxCost, keywords, classifications, setCode
    expect(screen.getByText(/filters \(7\)/i)).toBeInTheDocument();
  });

  describe('Focus management', () => {
    it('should focus the close button when modal opens', async () => {
      const {rerender} = render(<FilterModal {...defaultProps} isOpen={false} />);

      rerender(<FilterModal {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        // Get all buttons with close filters label, find the actual button (not backdrop)
        const closeButtons = screen.getAllByRole('button', {name: /close filters/i});
        const actualCloseButton = closeButtons.find((btn) => btn.tagName === 'BUTTON');
        expect(actualCloseButton).toHaveFocus();
      });
    });

    it('should restore focus to previous element when modal closes', async () => {
      const button = document.createElement('button');
      button.textContent = 'Open Filters';
      document.body.appendChild(button);
      button.focus();

      const {rerender} = render(<FilterModal {...defaultProps} isOpen={true} />);

      // Wait for focus to move to close button
      await waitFor(() => {
        const closeButtons = screen.getAllByRole('button', {name: /close filters/i});
        const actualCloseButton = closeButtons.find((btn) => btn.tagName === 'BUTTON');
        expect(actualCloseButton).toHaveFocus();
      });

      rerender(<FilterModal {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(button).toHaveFocus();
      });

      document.body.removeChild(button);
    });
  });

  describe('Focus trap', () => {
    it('should trap focus within modal on Tab', () => {
      render(<FilterModal {...defaultProps} />);

      const modal = screen.getByTestId('filter-modal');
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Simulate Tab on last element
      lastElement.focus();
      fireEvent.keyDown(modal, {key: 'Tab', shiftKey: false});

      // Focus should move to first element
      expect(firstElement).toHaveFocus();
    });

    it('should trap focus within modal on Shift+Tab', () => {
      render(<FilterModal {...defaultProps} />);

      const modal = screen.getByTestId('filter-modal');
      const focusableElements = modal.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      // Simulate Shift+Tab on first element
      firstElement.focus();
      fireEvent.keyDown(modal, {key: 'Tab', shiftKey: true});

      // Focus should move to last element
      expect(lastElement).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<FilterModal {...defaultProps} />);

      const modal = screen.getByRole('dialog');
      expect(modal).toHaveAttribute('aria-modal', 'true');
      expect(modal).toHaveAttribute('aria-labelledby', 'filter-modal-title');
    });

    it('should have accessible close button', () => {
      render(<FilterModal {...defaultProps} />);

      // Get all buttons with close filters label, verify at least one is the actual button
      const closeButtons = screen.getAllByRole('button', {name: /close filters/i});
      const actualCloseButton = closeButtons.find((btn) => btn.tagName === 'BUTTON');
      expect(actualCloseButton).toBeInTheDocument();
    });
  });
});
