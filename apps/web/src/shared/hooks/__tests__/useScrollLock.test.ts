import {describe, it, expect, beforeEach} from 'vitest';
import {renderHook} from '@testing-library/react';
import {useScrollLock} from '../useScrollLock';

describe('useScrollLock', () => {
  beforeEach(() => {
    document.body.style.overflow = '';
  });

  it('should set body overflow to hidden when open', () => {
    renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
  });

  it('should not modify overflow when not open', () => {
    renderHook(() => useScrollLock(false));
    expect(document.body.style.overflow).toBe('');
  });

  it('should restore previous overflow on unmount', () => {
    document.body.style.overflow = 'auto';
    const {unmount} = renderHook(() => useScrollLock(true));
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });

  it('should restore overflow when isOpen changes to false', () => {
    const {rerender} = renderHook(({isOpen}) => useScrollLock(isOpen), {
      initialProps: {isOpen: true},
    });
    expect(document.body.style.overflow).toBe('hidden');
    rerender({isOpen: false});
    expect(document.body.style.overflow).toBe('');
  });
});
