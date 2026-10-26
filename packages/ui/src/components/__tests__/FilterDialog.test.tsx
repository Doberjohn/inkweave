import {useState} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {FilterDialog, type FilterDialogProps} from '../FilterDialog';

function shellProps(overrides: Partial<FilterDialogProps> = {}): FilterDialogProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onApply: vi.fn(),
    onClearAll: vi.fn(),
    activeCount: 0,
    variant: 'modal',
    children: <p>The filters</p>,
    ...overrides,
  };
}

describe.each(['modal', 'drawer'] as const)('FilterDialog variant=%s', (variant) => {
  it('renders nothing while closed', () => {
    render(<FilterDialog {...shellProps({variant, isOpen: false})} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('counts what Clear all would clear in its title, or takes a title, and shows its children', () => {
    const {rerender} = render(<FilterDialog {...shellProps({variant, activeCount: 2})} />);
    expect(screen.getByRole('heading', {name: 'Filters (2)'})).toBeInTheDocument();
    expect(screen.getByText('The filters')).toBeInTheDocument();
    rerender(<FilterDialog {...shellProps({variant, activeCount: 2, title: 'Binder'})} />);
    expect(screen.getByRole('heading', {name: 'Binder'})).toBeInTheDocument();
  });

  it('shows Clear all only while something is on, and hands its press to onClearAll', () => {
    const onClearAll = vi.fn();
    const {rerender} = render(<FilterDialog {...shellProps({variant, onClearAll})} />);
    expect(screen.queryByRole('button', {name: 'Clear all'})).not.toBeInTheDocument();
    rerender(<FilterDialog {...shellProps({variant, onClearAll, activeCount: 1})} />);
    fireEvent.click(screen.getByRole('button', {name: 'Clear all'}));
    expect(onClearAll).toHaveBeenCalledTimes(1);
  });

  it('applies, then closes', () => {
    const onApply = vi.fn();
    const onClose = vi.fn();
    render(<FilterDialog {...shellProps({variant, onApply, onClose})} />);
    fireEvent.click(screen.getByRole('button', {name: /^Apply/}));
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onApply.mock.invocationCallOrder[0]).toBeLessThan(onClose.mock.invocationCallOrder[0]);
  });

  it('closes on Escape without applying, and hands focus back to its opener', async () => {
    const onApply = vi.fn();
    // Controlled, with no Dialog.Trigger: Radix's own return target is null (WCAG 2.4.3).
    function Page() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button type="button" onClick={() => setOpen(true)}>
            Open
          </button>
          <FilterDialog {...shellProps({variant, onApply, isOpen: open, onClose: () => setOpen(false)})} />
        </>
      );
    }
    render(<Page />);
    const opener = screen.getByRole('button', {name: 'Open'});
    opener.focus();
    fireEvent.click(opener);

    fireEvent.keyDown(await screen.findByRole('dialog'), {key: 'Escape'});

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(onApply).not.toHaveBeenCalled();
    await waitFor(() => expect(opener).toHaveFocus());
  });
});
