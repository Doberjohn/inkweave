import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {DialogShell} from '../DialogShell';

function renderShell(props: Partial<React.ComponentProps<typeof DialogShell>> = {}) {
  return render(
    <DialogShell isOpen onClose={vi.fn()} ariaLabel="Test dialog" scrimTestId="shell-scrim" {...props}>
      <button type="button">First</button>
      <button type="button">Last</button>
    </DialogShell>,
  );
}

describe('DialogShell', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders nothing while closed', () => {
    renderShell({isOpen: false});
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('renders a named modal dialog while open', () => {
    renderShell();
    const dialog = screen.getByRole('dialog', {name: 'Test dialog'});
    expect(dialog.getAttribute('aria-modal')).toBe('true');
  });

  it('closes on backdrop click', () => {
    const onClose = vi.fn();
    renderShell({onClose});
    fireEvent.click(screen.getByTestId('shell-scrim'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('disableBackdropClose suppresses the backdrop close', () => {
    const onClose = vi.fn();
    renderShell({onClose, disableBackdropClose: true});
    fireEvent.click(screen.getByTestId('shell-scrim'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on Escape at document level', () => {
    const onClose = vi.fn();
    renderShell({onClose});
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('focuses initialFocusRef 100ms after open', () => {
    const ref = {current: null as HTMLElement | null};
    render(
      <DialogShell isOpen onClose={vi.fn()} ariaLabel="Test dialog" initialFocusRef={ref}>
        <button type="button" ref={(el) => void (ref.current = el)}>
          Target
        </button>
      </DialogShell>,
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.activeElement).toBe(screen.getByRole('button', {name: 'Target'}));
  });

  it('falls back to focusing the panel itself without initialFocusRef', () => {
    renderShell();
    act(() => {
      vi.advanceTimersByTime(100);
    });
    expect(document.activeElement).toBe(screen.getByRole('dialog'));
  });

  it('Tab on the last focusable wraps to the first', () => {
    renderShell();
    // Taken by position, not by index into a fixed list: the shell's own close ×
    // is the first focusable, so a destructured [first, last] would compare the
    // × against the SECOND child rather than the last.
    const buttons = screen.getAllByRole('button');
    buttons[buttons.length - 1].focus();
    fireEvent.keyDown(screen.getByRole('dialog'), {key: 'Tab'});
    expect(document.activeElement).toBe(buttons[0]);
  });

  it('renders a close button that dismisses the dialog', () => {
    const onClose = vi.fn();
    render(
      <DialogShell isOpen onClose={onClose} ariaLabel="Test dialog">
        <button type="button">First</button>
      </DialogShell>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('omits the close button when the content supplies its own', () => {
    render(
      <DialogShell isOpen onClose={vi.fn()} ariaLabel="Test dialog" showClose={false}>
        <button type="button">First</button>
      </DialogShell>,
    );
    expect(screen.queryByRole('button', {name: 'Close'})).toBeNull();
  });

  /** Open the shell, then flip isOpen false; returns with the exit transition pending. */
  function renderClosing() {
    const {rerender} = renderShell();
    rerender(
      <DialogShell isOpen={false} onClose={vi.fn()} ariaLabel="Test dialog" scrimTestId="shell-scrim">
        <button type="button">First</button>
        <button type="button">Last</button>
      </DialogShell>,
    );
    return screen.getByRole('dialog');
  }

  it('unmounts after the exit transition completes', () => {
    const dialog = renderClosing();
    fireEvent.transitionEnd(dialog);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('unmounts via the fallback timer when transitionend never fires (reduced motion)', () => {
    renderClosing();
    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('locks body scroll while open and restores on unmount', () => {
    const {unmount} = renderShell();
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).not.toBe('hidden');
  });

  it('transition="none" renders exactly while isOpen with no presence deferral', () => {
    const {rerender} = renderShell({transition: 'none'});
    expect(screen.getByRole('dialog')).toBeTruthy();
    rerender(
      <DialogShell isOpen={false} onClose={vi.fn()} ariaLabel="Test dialog" transition="none">
        <button type="button">First</button>
      </DialogShell>,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
