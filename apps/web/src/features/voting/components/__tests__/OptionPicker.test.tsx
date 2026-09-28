import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {OptionPicker} from '../OptionPicker';

const OPTIONS = [
  {key: 'yes', label: 'Yes', value: 'yes'},
  {key: 'no', label: 'No', value: 'no'},
];

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
});
