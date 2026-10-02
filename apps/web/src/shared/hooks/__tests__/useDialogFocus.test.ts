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

  it.each([
    {isOpen: true, calls: 1},
    {isOpen: false, calls: 0},
  ])('should call onClose on Escape only while open (isOpen: $isOpen)', ({isOpen, calls}) => {
    const onClose = vi.fn();
    const containerRef = createRef<HTMLElement>();
    const initialFocusRef = createRef<HTMLElement>();

    renderHook(() => useDialogFocus({isOpen, containerRef, initialFocusRef, onClose}));

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {key: 'Escape'}));
    });

    expect(onClose).toHaveBeenCalledTimes(calls);
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

  it('leaves focus alone when the user already reached inside before the one-shot fires', () => {
    // The 100ms wait is long enough to lose a race with a real user: a click or a
    // key inside the dialog lands first, and focus was then yanked to the close
    // button. DialogShell's useFocusRetry already guards for this; the one-shot
    // did not, which is what made CardOverviewModal's arrow-key test flaky.
    const container = document.createElement('div');
    const closeButton = document.createElement('button');
    const pill = document.createElement('button');
    container.append(closeButton, pill);
    document.body.appendChild(container);
    const closeSpy = vi.spyOn(closeButton, 'focus');

    renderHook(() =>
      useDialogFocus({
        isOpen: true,
        containerRef: {current: container},
        initialFocusRef: {current: closeButton},
        onClose: vi.fn(),
      }),
    );

    pill.focus();
    act(() => {
      vi.advanceTimersByTime(150);
    });

    expect(document.activeElement).toBe(pill);
    expect(closeSpy).not.toHaveBeenCalled();
    document.body.removeChild(container);
  });

  it('should restore focus to the element focused at open when closed', () => {
    const trigger = document.createElement('button');
    const inside = document.createElement('button');
    document.body.appendChild(trigger);
    document.body.appendChild(inside);
    trigger.focus();
    const containerRef = createRef<HTMLElement>();
    const initialFocusRef = {current: inside};

    const {rerender} = renderHook(
      ({isOpen}) => useDialogFocus({isOpen, containerRef, initialFocusRef, onClose: vi.fn()}),
      {initialProps: {isOpen: true}},
    );
    act(() => {
      vi.advanceTimersByTime(100);
    });
    rerender({isOpen: false});

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
    document.body.removeChild(inside);
  });

  it('should return focus to returnFocusRef instead of the element focused at open', () => {
    // SearchBottomSheet focuses a hidden proxy input just before opening (the iOS
    // keyboard trick), so the element focused at open is the wrong place to return to.
    const trigger = document.createElement('button');
    const proxy = document.createElement('input');
    document.body.appendChild(trigger);
    document.body.appendChild(proxy);
    proxy.focus();
    const containerRef = createRef<HTMLElement>();
    const initialFocusRef = createRef<HTMLElement>();
    const returnFocusRef = {current: trigger};

    const {rerender} = renderHook(
      ({isOpen}) =>
        useDialogFocus({isOpen, containerRef, initialFocusRef, returnFocusRef, onClose: vi.fn()}),
      {initialProps: {isOpen: true}},
    );
    rerender({isOpen: false});

    expect(document.activeElement).toBe(trigger);
    document.body.removeChild(trigger);
    document.body.removeChild(proxy);
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
