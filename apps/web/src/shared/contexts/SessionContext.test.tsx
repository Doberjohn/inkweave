import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {SessionProvider, useSession} from './SessionContext';

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
