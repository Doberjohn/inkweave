import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {SessionProvider, useIsSignedIn, useSession} from './SessionContext';

// A minimal Supabase auth double; `mockState.client` swaps between "configured" and
// "not configured" (getSupabase() === null).
const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));
const mockState = vi.hoisted(() => ({client: null as unknown}));

vi.mock('../lib/supabase', () => ({
  getSupabase: () => mockState.client,
}));

function wrapper({children}: {children: ReactNode}) {
  return <SessionProvider>{children}</SessionProvider>;
}
const render = () => renderHook(() => useSession(), {wrapper});

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.getSession.mockResolvedValue({data: {session: null}});
  mockAuth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe: vi.fn()}}});
  mockAuth.signInWithOAuth.mockResolvedValue({error: null});
  mockAuth.signOut.mockResolvedValue({error: null});
  mockState.client = {auth: mockAuth};
});

describe('SessionContext', () => {
  it('is enabled and resolves loading when Supabase is configured', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.enabled).toBe(true);
    expect(result.current.session).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it('signIn starts an OAuth redirect to /auth/callback for the provider', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signIn('discord');
    });
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: {redirectTo: expect.stringContaining('/auth/callback')},
    });
  });

  it('signOut calls Supabase signOut', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.signOut();
    });
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  /*
    signOut used to return void and discard Supabase's error, so a refused logout (an
    expired refresh token, a dropped connection) left the user pressing a button that
    appeared to do nothing. It now reports, and AccountPage renders what it reports.
  */
  it('signOut reports a refused logout rather than swallowing it', async () => {
    mockAuth.signOut.mockResolvedValue({error: {message: 'Logout failed'}});
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: {error: string | null} | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });
    expect(outcome).toEqual({error: 'Logout failed'});
  });

  it('signOut reports no error on success', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: {error: string | null} | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });
    expect(outcome).toEqual({error: null});
  });

  it('is disabled and no-ops when Supabase is not configured', async () => {
    mockState.client = null;
    const {result} = render();
    expect(result.current.enabled).toBe(false);
    expect(result.current.loading).toBe(false);
    const res = await result.current.signIn('google');
    expect(res.error).toBeTruthy();
    expect(mockAuth.signInWithOAuth).not.toHaveBeenCalled();
  });
});

/*
  useIsSignedIn's TRUE branch. It had no coverage anywhere: the two tests in
  contexts/__tests__/SessionContext.test.tsx both run with the env blanked, so the provider
  mounts auth-disabled and only the false branch is exercised. A regression hard-coding
  `false` would have passed every one of them. This file already owns a client double, so
  the signed-in state is reachable here and nowhere else.
*/
describe('useIsSignedIn', () => {
  it('is true once a stored session resolves', async () => {
    mockAuth.getSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
    const {result} = renderHook(() => useIsSignedIn(), {wrapper});
    await waitFor(() => expect(result.current).toBe(true));
  });

  // The window the desktop nav must not misread: signed in, but the probe has not landed.
  it('is false while the session is still resolving', () => {
    mockAuth.getSession.mockReturnValue(new Promise(() => {}));
    const {result} = renderHook(() => useIsSignedIn(), {wrapper});
    expect(result.current).toBe(false);
  });
});
