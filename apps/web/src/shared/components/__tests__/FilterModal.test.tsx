import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {FilterModal} from '../FilterModal';

describe('FilterModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onApply: vi.fn(),
    inkFilters: [] as string[],
    typeFilters: [] as string[],
    costFilters: [] as number[],
    filters: {},
    uniqueKeywords: ['Singer', 'Evasive', 'Ward'],
    uniqueClassifications: ['Princess', 'Hero', 'Villain'],
    sets: [
      {code: '1', name: 'The First Chapter', number: 1},
      {code: '5', name: 'Shimmering Skies', number: 5},
      {code: '10', name: 'Set Ten', number: 10},
    ],
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

  it('should toggle ink in draft state without calling onApply', () => {
    render(<FilterModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));

    // Draft state changes locally — onApply NOT called yet
    expect(defaultProps.onApply).not.toHaveBeenCalled();
    // Amber should now be visually active
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');
  });

  it('should call onApply with draft state when clicking Apply button', () => {
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onApply={onApply} />);

    // Toggle some draft filters
    fireEvent.click(screen.getByRole('button', {name: /amber/i}));
    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    // Click Apply
    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith(['Amber'], ['Character'], [], {});
  });

  it('should call onClose when clicking Apply button', () => {
    const onClose = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop (discards draft)', () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} onApply={onApply} />);

    const backdrop = screen.getByTestId('filter-modal-backdrop');
    fireEvent.click(backdrop);

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should close on Escape key (discards draft)', () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onClose={onClose} onApply={onApply} />);

    fireEvent.keyDown(document, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should show Clear all button when draft filters are active', () => {
    render(<FilterModal {...defaultProps} inkFilters={['Amber']} />);

    expect(screen.getByRole('button', {name: /clear all/i})).toBeInTheDocument();
  });

  it('should not show Clear all button when no filters are active', () => {
    render(<FilterModal {...defaultProps} />);

    expect(screen.queryByRole('button', {name: /clear all/i})).not.toBeInTheDocument();
  });

  it('should clear draft state when clicking Clear all', () => {
    render(<FilterModal {...defaultProps} inkFilters={['Amber']} />);

    // Amber should start as active (from initial props)
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', {name: /clear all/i}));

    // After clear, all should be inactive
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should show active filter count in title from draft state', () => {
    render(<FilterModal {...defaultProps} inkFilters={['Amber']} typeFilters={['Character']} />);

    // Draft initializes from props: 1 ink + 1 type = 2
    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it('should mark current ink as active from draft state', () => {
    render(<FilterModal {...defaultProps} inkFilters={['Ruby']} />);

    expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should toggle type in draft state', () => {
    render(<FilterModal {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('should update draft keyword via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0];
    fireEvent.change(keywordSelect, {target: {value: 'Singer'}});

    // Apply to capture the draft
    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {keywords: ['Singer']});
  });

  it('should update draft classification via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    const classificationSelect = selects[1];
    fireEvent.change(classificationSelect, {target: {value: 'Princess'}});

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {classifications: ['Princess']});
  });

  it('should update draft set via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterModal {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    const setSelect = selects[2];
    fireEvent.change(setSelect, {target: {value: '5'}});

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {setCode: '5'});
  });

  it('should show selected keyword value in dropdown', () => {
    render(<FilterModal {...defaultProps} filters={{keywords: ['Evasive']}} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0] as HTMLSelectElement;

    expect(keywordSelect.value).toBe('Evasive');
  });

  it('should count all active draft filters correctly', () => {
    render(
      <FilterModal
        {...defaultProps}
        inkFilters={['Amber']}
        typeFilters={['Character']}
        costFilters={[2, 5]}
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

  describe('Draft reset on reopen', () => {
    it('should discard draft and reset to committed state when reopened', () => {
      const {rerender} = render(<FilterModal {...defaultProps} />);

      // Toggle Amber in draft
      fireEvent.click(screen.getByRole('button', {name: /amber/i}));
      expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');

      // Close without applying (discard)
      rerender(<FilterModal {...defaultProps} isOpen={false} />);

      // Reopen — draft should reset to committed (empty) state
      rerender(<FilterModal {...defaultProps} isOpen={true} />);
      expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
    });

    it('should preserve committed filters when reopened after apply', () => {
      const onApply = vi.fn();
      const {rerender} = render(<FilterModal {...defaultProps} onApply={onApply} />);

      // Toggle Ruby and apply
      fireEvent.click(screen.getByRole('button', {name: /ruby/i}));
      fireEvent.click(screen.getByRole('button', {name: /apply/i}));

      // Reopen with committed state reflecting the applied filter
      rerender(<FilterModal {...defaultProps} isOpen={false} onApply={onApply} />);
      rerender(
        <FilterModal {...defaultProps} isOpen={true} inkFilters={['Ruby']} onApply={onApply} />,
      );

      expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    });
  });

  describe('Focus management', () => {
    it('should focus the close button when modal opens', async () => {
      const {rerender} = render(<FilterModal {...defaultProps} isOpen={false} />);

      rerender(<FilterModal {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        // Verify close button receives focus
        expect(screen.getByRole('button', {name: /close filters/i})).toHaveFocus();
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
        expect(screen.getByRole('button', {name: /close filters/i})).toHaveFocus();
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

      expect(screen.getByRole('button', {name: /close filters/i})).toBeInTheDocument();
    });
  });
});
