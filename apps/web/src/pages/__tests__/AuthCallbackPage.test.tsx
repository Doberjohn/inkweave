import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {RouterProvider, createMemoryRouter} from 'react-router-dom';
import type {Session} from '@supabase/auth-js';
import {AuthCallbackPage} from '../AuthCallbackPage';
import {trackSignInCompleted, trackSignInFailed} from '../../shared/lib/signInAnalytics';

const {sessionState} = vi.hoisted(() => ({
  sessionState: {session: null as Session | null, loading: false},
}));

vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => sessionState,
}));

vi.mock('../../shared/lib/signInAnalytics', async () => {
  const actual = await vi.importActual('../../shared/lib/signInAnalytics');
  return {...actual, trackSignInCompleted: vi.fn(), trackSignInFailed: vi.fn()};
});

const SESSION = {user: {id: 'user-1', app_metadata: {provider: 'google'}}} as unknown as Session;

/** The page as the provider's redirect opens it: `url` is the whole callback URL path. */
function renderCallback(url: string) {
  window.history.replaceState(null, '', url);
  const router = createMemoryRouter(
    [
      {path: '/auth/callback', element: <AuthCallbackPage />},
      {path: '/account', element: <p>Account page</p>},
    ],
    {initialEntries: ['/auth/callback']},
  );
  render(<RouterProvider router={router} />);
}

describe('AuthCallbackPage analytics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionState.session = null;
  });

  afterEach(() => {
    vi.useRealTimers();
    window.history.replaceState(null, '', '/');
  });

  it('tracks a session that arrives as a completed sign-in, then lands on the account page', async () => {
    sessionState.session = SESSION;
    renderCallback('/auth/callback');

    expect(await screen.findByText('Account page')).toBeInTheDocument();
    expect(trackSignInCompleted).toHaveBeenCalledWith(SESSION);
    expect(trackSignInFailed).not.toHaveBeenCalled();
  });

  it.each([
    {url: '/auth/callback?code=abc', reason: 'timeout'},
    {url: '/auth/callback#error=access_denied&error_description=denied', reason: 'cancelled'},
  ])('tracks no session after 4 seconds as a failed callback ($reason)', ({url, reason}) => {
    vi.useFakeTimers();
    renderCallback(url);

    act(() => {
      vi.advanceTimersByTime(4000);
    });

    expect(trackSignInFailed).toHaveBeenCalledWith({provider: null, stage: 'callback', reason});
    expect(screen.getByText("Sign-in didn't complete.")).toBeInTheDocument();
  });
});
