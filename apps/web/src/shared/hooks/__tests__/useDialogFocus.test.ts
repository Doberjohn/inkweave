import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import {useDialogFocus} from '../useDialogFocus';
import {createRef} from 'react';

describe('useDialogFocus', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should close on Escape key', () => {
    const onClose = vi.fn();
    const containerRef = createRef<HTMLElement>();
    const initialFocusRef = createRef<HTMLElement>();

    renderHook(() => useDialogFocus({isOpen: true, containerRef, initialFocusRef, onClose}));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });

    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should not listen for Escape when closed', () => {
    const onClose = vi.fn();
    const containerRef = createRef<HTMLElement>();
    const initialFocusRef = createRef<HTMLElement>();

    renderHook(() => useDialogFocus({isOpen: false, containerRef, initialFocusRef, onClose}));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should focus initialFocusRef after timeout when opened', () => {
    const onClose = vi.fn();
    const containerRef = createRef<HTMLElement>();
    const focusEl = document.createElement('button');
    document.body.appendChild(focusEl);
    const focusSpy = vi.spyOn(focusEl, 'focus');
    const initialFocusRef = {current: focusEl};

    renderHook(() => useDialogFocus({isOpen: true, containerRef, initialFocusRef, onClose}));

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(focusSpy).toHaveBeenCalled();
    document.body.removeChild(focusEl);
  });

  it('should wrap focus from last to first element on Tab', () => {
    const container = document.createElement('div');
    const btn1 = document.createElement('button');
    const btn2 = document.createElement('button');
    container.appendChild(btn1);
    container.appendChild(btn2);
    document.body.appendChild(container);

    const containerRef = {current: container};
    const initialFocusRef = createRef<HTMLElement>();
    const onClose = vi.fn();

    const {result} = renderHook(() =>
      useDialogFocus({isOpen: true, containerRef, initialFocusRef, onClose}),
    );

    // Simulate focus on last element, then Tab
    btn2.focus();
    const event = {
      key: 'Tab',
      shiftKey: false,
      preventDefault: vi.fn(),
    } as unknown as React.KeyboardEvent;

    act(() => {
      result.current.handleKeyDown(event);
    });

    expect(event.preventDefault).toHaveBeenCalled();
    expect(document.activeElement).toBe(btn1);

    document.body.removeChild(container);
  });
});
