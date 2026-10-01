import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {OptionPicker} from '../OptionPicker';

const OPTIONS = [
  {key: 'yes', label: 'Yes', value: 'yes'},
  {key: 'no', label: 'No', value: 'no'},
];

const animationOf = (name: string) => screen.getByRole('radio', {name}).style.animation;

describe('OptionPicker', () => {
  it('cancels the click-pulse timer on unmount (no leaked timer)', () => {
    vi.useFakeTimers();
    try {
      const {unmount} = render(
        <OptionPicker ariaLabel="Is it real" options={OPTIONS} value={null} onChange={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('radio', {name: 'Yes'}));
      expect(vi.getTimerCount()).toBe(1); // the 300ms pulse-reset timer is scheduled
      unmount();
      // A leaked timer firing setState into a torn-down tree crashed CI's coverage
      // run with "window is not defined"; the cleanup must cancel it on unmount.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('gives an option clicked mid-pulse its full 300ms pulse', () => {
    vi.useFakeTimers();
    try {
      render(
        <OptionPicker ariaLabel="Is it real" options={OPTIONS} value={null} onChange={vi.fn()} />,
      );
      fireEvent.click(screen.getByRole('radio', {name: 'Yes'}));
      act(() => { vi.advanceTimersByTime(100); });
      fireEvent.click(screen.getByRole('radio', {name: 'No'}));
      expect(vi.getTimerCount()).toBe(1); // switching options cancels the first pulse's timer
      act(() => { vi.advanceTimersByTime(299); });
      expect(animationOf('No')).toContain('idv-pulse');
      act(() => { vi.advanceTimersByTime(1); });
      expect(animationOf('No')).not.toContain('idv-pulse');
    } finally {
      vi.useRealTimers();
    }
  });
});
