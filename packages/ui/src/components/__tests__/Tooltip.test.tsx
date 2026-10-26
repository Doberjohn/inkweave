import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen} from '@testing-library/react';
import {HelpTooltip} from '../Tooltip';

const SCALE = 'Perfect: 9.5 and up\nWeak: under 4';

function renderHelp() {
  render(<HelpTooltip content={SCALE} label="What does this score mean?" />);
  return screen.getByRole('button', {name: 'What does this score mean?'});
}

describe('Tooltip', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders no tooltip, and names none, while hidden', () => {
    const button = renderHelp();
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).not.toHaveAttribute('aria-describedby');
  });

  it('shows on focus and describes its control with its text', () => {
    const button = renderHelp();
    fireEvent.focus(button);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Perfect: 9.5 and up');
    expect(button).toHaveAccessibleDescription(/^Perfect: 9\.5 and up/);
  });

  it('hides on Escape, keeping focus and keeping the key from a listener on document', () => {
    const dialogEscape = vi.fn();
    document.addEventListener('keydown', dialogEscape);
    const button = renderHelp();
    act(() => button.focus());
    fireEvent.keyDown(button, {key: 'Escape'});
    document.removeEventListener('keydown', dialogEscape);
    expect(screen.queryByRole('tooltip')).toBeNull();
    expect(button).toHaveFocus();
    expect(dialogEscape).not.toHaveBeenCalled();
  });

  it('stays for 150 ms once the pointer leaves its control', () => {
    vi.useFakeTimers();
    const button = renderHelp();
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    act(() => {
      vi.advanceTimersByTime(149);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays while the pointer is on it, and hides once the pointer leaves it too', () => {
    vi.useFakeTimers();
    const button = renderHelp();
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    fireEvent.mouseEnter(screen.getByRole('tooltip'));
    act(() => {
      vi.advanceTimersByTime(1000);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.mouseLeave(screen.getByRole('tooltip'));
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('stays while its control has focus, wherever the pointer goes', () => {
    vi.useFakeTimers();
    const button = renderHelp();
    fireEvent.focus(button);
    fireEvent.mouseEnter(button);
    fireEvent.mouseLeave(button);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  });

  it("doesn't stay for the focus a mouse click gives its control", () => {
    vi.useFakeTimers();
    const button = renderHelp();
    fireEvent.mouseEnter(button);
    fireEvent.pointerDown(button);
    fireEvent.focus(button);
    fireEvent.pointerUp(document);
    fireEvent.mouseLeave(button);
    act(() => {
      vi.advanceTimersByTime(150);
    });
    expect(screen.queryByRole('tooltip')).toBeNull();
  });
});
