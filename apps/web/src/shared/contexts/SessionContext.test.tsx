import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {SessionProvider, useIsSignedIn, useSession} from './SessionContext';

// A minimal Supabase auth double. `mockState.configured` is the env check; `mockState.load`
// is what loadSupabase() does when asked, so a test can count downloads or make one fail.
const mockAuth = vi.hoisted(() => ({
  getSession: vi.fn(),
  onAuthStateChange: vi.fn(),
  signInWithOAuth: vi.fn(),
  signOut: vi.fn(),
}));
const mockState = vi.hoisted(() => ({
  configured: true,
  load: vi.fn(),
}));

vi.mock('../lib/supabase', () => ({
  AUTH_STORAGE_KEY: 'inkweave:auth',
  isSupabaseConfigured: () => mockState.configured,
  loadSupabase: () => mockState.load(),
}));

function wrapper({children}: {children: ReactNode}) {
  return <SessionProvider>{children}</SessionProvider>;
}
const render = () => renderHook(() => useSession(), {wrapper});

/** A returning visitor: supabase-js has persisted a session under its storage key. */
function storeSession() {
  localStorage.setItem('inkweave:auth', '{"access_token":"stored"}');
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  window.history.replaceState(null, '', '/');
  mockAuth.getSession.mockResolvedValue({data: {session: null}});
  mockAuth.onAuthStateChange.mockReturnValue({data: {subscription: {unsubscribe: vi.fn()}}});
  mockAuth.signInWithOAuth.mockResolvedValue({error: null});
  mockAuth.signOut.mockResolvedValue({error: null});
  mockState.configured = true;
  mockState.load.mockResolvedValue({auth: mockAuth});
});

afterEach(() => {
  localStorage.clear();
});

describe('SessionContext', () => {
  // The point of #729: an anonymous visitor never downloads supabase-js.
  it('does not load the SDK when there is no session to restore', () => {
    const {result} = render();
    expect(result.current.enabled).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(mockState.load).not.toHaveBeenCalled();
  });

  it('loads the SDK and restores a stored session', async () => {
    storeSession();
    mockAuth.getSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
    const {result} = render();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toEqual({id: 'u1'});
    expect(mockAuth.onAuthStateChange).toHaveBeenCalledOnce();
  });

  // The OAuth return carries a code, not a stored session yet: it must still load. The second
  // case is Supabase's fallback to the Site URL when it rejects `redirectTo`.
  it.each(['/auth/callback', '/?code=abc'])('loads the SDK on %s with nothing stored', async (url) => {
    window.history.replaceState(null, '', url);
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(mockState.load).toHaveBeenCalledOnce();
  });

  it('resolves loading when the SDK fails to download', async () => {
    storeSession();
    mockState.load.mockRejectedValue(new Error('offline'));
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.session).toBeNull();
  });

  it('signIn loads the SDK and starts an OAuth redirect to /auth/callback', async () => {
    const {result} = render();
    await act(async () => {
      await result.current.signIn('discord');
    });
    expect(mockState.load).toHaveBeenCalledOnce();
    expect(mockAuth.signInWithOAuth).toHaveBeenCalledWith({
      provider: 'discord',
      options: {redirectTo: expect.stringContaining('/auth/callback')},
    });
  });

  it('signIn reports an SDK that fails to download', async () => {
    mockState.load.mockRejectedValue(new Error('offline'));
    const {result} = render();
    let outcome: {error: string | null} | undefined;
    await act(async () => {
      outcome = await result.current.signIn('google');
    });
    expect(outcome?.error).toMatch(/could not start/i);
  });

  /*
    signOut used to return void and discard Supabase's error, so a refused logout (an
    expired refresh token, a dropped connection) left the user pressing a button that
    appeared to do nothing. It now reports, and AccountPage renders what it reports.
  */
  it('signOut reports a refused logout rather than swallowing it', async () => {
    storeSession();
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
    storeSession();
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let outcome: {error: string | null} | undefined;
    await act(async () => {
      outcome = await result.current.signOut();
    });
    expect(outcome).toEqual({error: null});
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('is disabled and no-ops when Supabase is not configured', async () => {
    mockState.configured = false;
    storeSession();
    const {result} = render();
    expect(result.current.enabled).toBe(false);
    expect(result.current.loading).toBe(false);
    const res = await result.current.signIn('google');
    expect(res.error).toBeTruthy();
    expect(mockState.load).not.toHaveBeenCalled();
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
    storeSession();
    mockAuth.getSession.mockResolvedValue({data: {session: {user: {id: 'u1'}}}});
    const {result} = renderHook(() => useIsSignedIn(), {wrapper});
    await waitFor(() => expect(result.current).toBe(true));
  });

  // The window the desktop nav must not misread: signed in, but the probe has not landed.
  it('is false while the session is still resolving', () => {
    storeSession();
    mockAuth.getSession.mockReturnValue(new Promise(() => {}));
    const {result} = renderHook(() => useIsSignedIn(), {wrapper});
    expect(result.current).toBe(false);
  });
});
