import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {CompactHeader} from '../CompactHeader';
import {SessionProvider} from '../../contexts/SessionContext';
import {_resetClient} from '../../lib/supabase';

// Pin the reveal phase so the test never depends on VITE_IS_REVEAL_SEASON: with the flag on
// (e.g. from .env.local), the real hook starts fetching reveal dates in the background.
vi.mock('../../../features/reveals', () => ({useRevealPhase: () => 'hidden'}));

// Same hazard, second source: the header now renders the auth control, so this mounts the
// REAL SessionProvider. With Supabase credentials in .env.local, loadSupabase() would build a
// live PKCE client and the provider would call getSession()/onAuthStateChange against it,
// making the result depend on who is running the test. Blank the vars and drop the memoised
// client, exactly as contexts/__tests__/SessionContext.test.tsx does.
beforeEach(() => {
  _resetClient();
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
});

afterEach(() => {
  vi.unstubAllEnvs();
  _resetClient();
});

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
      const input = screen.getByTestId('header-search');
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

describe("CompactHeader's skip link", () => {
  const renderHeader = (isMobile?: boolean) =>
    render(
      <MemoryRouter>
        <SessionProvider>
          <CompactHeader isMobile={isMobile} />
        </SessionProvider>
      </MemoryRouter>,
    );

  it('comes before the header, as the link the stylesheet clips away until it has focus', () => {
    const {container} = renderHeader();
    const link = screen.getByRole('link', {name: 'Skip to main content'});

    expect(container.querySelector('a, button, input, select')).toBe(link);
    // index.css's `.skip-link:not(:focus)`, which jsdom doesn't load: skip-link.spec.ts checks
    // in a browser that it shows only while focused.
    expect(link).toHaveClass('skip-link');
  });

  it('moves focus past the header, leaving the address as it is', () => {
    renderHeader();
    const target = document.getElementById('main-content')!;

    expect(screen.getByTestId('compact-header').compareDocumentPosition(target)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    // fireEvent returns false once a handler has called preventDefault: no fragment navigation.
    expect(fireEvent.click(screen.getByRole('link', {name: 'Skip to main content'}))).toBe(false);
    expect(target).toHaveFocus();
    expect(target).toHaveAttribute('tabindex', '-1');
  });

  it('renders on a phone no more than the header does: nothing', () => {
    const {container} = renderHeader(true);
    expect(container).toBeEmptyDOMElement();
  });
});
