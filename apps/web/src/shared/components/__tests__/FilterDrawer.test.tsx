import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent, waitFor} from '@testing-library/react';
import {FilterDrawer} from '../FilterDrawer';

describe('FilterDrawer', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('should toggle ink in draft state without calling onApply', () => {
    render(<FilterDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));

    expect(defaultProps.onApply).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');
  });

  it('should call onApply with draft state when clicking Apply button', () => {
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onApply={onApply} />);

    fireEvent.click(screen.getByRole('button', {name: /amber/i}));
    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith(['Amber'], ['Character'], [], {});
  });

  it('should call onClose when clicking Apply button', () => {
    const onClose = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} />);

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onClose).toHaveBeenCalled();
  });

  it('should call onClose when clicking backdrop (discards draft)', () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} onApply={onApply} />);

    fireEvent.click(screen.getByTestId('filter-drawer-backdrop'));

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should close on Escape key (discards draft)', () => {
    const onClose = vi.fn();
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onClose={onClose} onApply={onApply} />);

    fireEvent.keyDown(document, {key: 'Escape'});

    expect(onClose).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });

  it('should show Clear all button when draft filters are active', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} />);

    expect(screen.getByRole('button', {name: /clear all/i})).toBeInTheDocument();
  });

  it('should not show Clear all button when no filters are active', () => {
    render(<FilterDrawer {...defaultProps} />);

    expect(screen.queryByRole('button', {name: /clear all/i})).not.toBeInTheDocument();
  });

  it('should clear draft state when clicking Clear all', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} />);

    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(screen.getByRole('button', {name: /clear all/i}));

    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should show active filter count in title from draft state', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Amber']} typeFilters={['Character']} />);

    expect(screen.getByText(/filters \(2\)/i)).toBeInTheDocument();
  });

  it('should mark current ink as active from draft state', () => {
    render(<FilterDrawer {...defaultProps} inkFilters={['Ruby']} />);

    expect(screen.getByRole('button', {name: /ruby/i})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /amber/i})).toHaveAttribute('aria-pressed', 'false');
  });

  it('should toggle type in draft state', () => {
    render(<FilterDrawer {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', {name: /character/i}));

    expect(screen.getByRole('button', {name: /character/i})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(defaultProps.onApply).not.toHaveBeenCalled();
  });

  it('should update draft keyword via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[0], {target: {value: 'Singer'}});

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {keywords: ['Singer']});
  });

  it('should update draft classification via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[1], {target: {value: 'Princess'}});

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {classifications: ['Princess']});
  });

  it('should update draft set via dropdown', () => {
    const onApply = vi.fn();
    render(<FilterDrawer {...defaultProps} onApply={onApply} />);

    const selects = screen.getAllByRole('combobox');
    fireEvent.change(selects[2], {target: {value: '5'}});

    fireEvent.click(screen.getByRole('button', {name: /apply/i}));

    expect(onApply).toHaveBeenCalledWith([], [], [], {setCode: '5'});
  });

  it('should show selected keyword value in dropdown', () => {
    render(<FilterDrawer {...defaultProps} filters={{keywords: ['Evasive']}} />);

    const selects = screen.getAllByRole('combobox');
    const keywordSelect = selects[0] as HTMLSelectElement;

    expect(keywordSelect.value).toBe('Evasive');
  });

  it('should count all active draft filters correctly', () => {
    render(
      <FilterDrawer
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

    expect(screen.getByText(/filters \(7\)/i)).toBeInTheDocument();
  });

  describe('Focus management', () => {
    it('should focus the Apply button when drawer opens', async () => {
      const {rerender} = render(<FilterDrawer {...defaultProps} isOpen={false} />);

      rerender(<FilterDrawer {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', {name: /apply/i})).toHaveFocus();
      });
    });

    it('should restore focus to previous element when drawer closes', async () => {
      const button = document.createElement('button');
      button.textContent = 'Open Filters';
      document.body.appendChild(button);
      button.focus();

      const {rerender} = render(<FilterDrawer {...defaultProps} isOpen={true} />);

      await waitFor(() => {
        expect(screen.getByRole('button', {name: /apply/i})).toHaveFocus();
      });

      rerender(<FilterDrawer {...defaultProps} isOpen={false} />);

      await waitFor(() => {
        expect(button).toHaveFocus();
      });

      document.body.removeChild(button);
    });
  });

  describe('Focus trap', () => {
    it('should trap focus within drawer on Tab', () => {
      render(<FilterDrawer {...defaultProps} />);

      const drawer = screen.getByRole('dialog');
      const focusableElements = drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      lastElement.focus();
      fireEvent.keyDown(drawer, {key: 'Tab', shiftKey: false});

      expect(firstElement).toHaveFocus();
    });

    it('should trap focus within drawer on Shift+Tab', () => {
      render(<FilterDrawer {...defaultProps} />);

      const drawer = screen.getByRole('dialog');
      const focusableElements = drawer.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );

      expect(focusableElements.length).toBeGreaterThan(0);

      const firstElement = focusableElements[0];
      const lastElement = focusableElements[focusableElements.length - 1];

      firstElement.focus();
      fireEvent.keyDown(drawer, {key: 'Tab', shiftKey: true});

      expect(lastElement).toHaveFocus();
    });
  });

  describe('Accessibility', () => {
    it('should have correct ARIA attributes', () => {
      render(<FilterDrawer {...defaultProps} />);

      const drawer = screen.getByRole('dialog');
      expect(drawer).toHaveAttribute('aria-modal', 'true');
      expect(drawer).toHaveAttribute('aria-labelledby', 'filter-drawer-title');
    });

    it('should have aria-hidden backdrop', () => {
      render(<FilterDrawer {...defaultProps} />);

      const backdrop = screen.getByTestId('filter-drawer-backdrop');
      expect(backdrop).toHaveAttribute('aria-hidden', 'true');
    });
  });
});
