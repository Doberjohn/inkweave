import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {CompactHeader} from '../CompactHeader';
import {SessionProvider} from '../../contexts/SessionContext';

// Pin the reveal phase so the test never depends on VITE_IS_REVEAL_SEASON: with the flag on
// (e.g. from .env.local), the real hook starts fetching reveal dates in the background.
vi.mock('../../../features/reveals', () => ({useRevealPhase: () => 'hidden'}));

describe('CompactHeader', () => {
  it('cancels the search blur timer on unmount (no leaked timer)', () => {
    vi.useFakeTimers();
    try {
      const {unmount} = render(
        <MemoryRouter>
          {/* The header renders the auth control now, so useSession needs a provider. */}
          <SessionProvider>
            <CompactHeader searchQuery="" onSearchChange={vi.fn()} />
          </SessionProvider>
        </MemoryRouter>,
      );
      const input = screen.getByTestId('browse-search');
      fireEvent.focus(input);
      fireEvent.blur(input);
      expect(vi.getTimerCount()).toBe(1); // only the hook's 150ms blur timer is pending
      unmount();
      // A leaked timer firing setState into a torn-down tree crashed CI's coverage run
      // with "window is not defined"; the cleanup must cancel it on unmount.
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });
});
