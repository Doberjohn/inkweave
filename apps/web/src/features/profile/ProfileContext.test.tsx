import {describe, it, expect, vi, beforeEach} from 'vitest';
import {renderHook, act, waitFor} from '@testing-library/react';
import type {ReactNode} from 'react';
import {ProfileProvider, useProfile} from './ProfileContext';

const mockClaim = vi.hoisted(() => vi.fn());
const mockSession = vi.hoisted(() => ({user: null as {id: string} | null}));

vi.mock('./profileRepository', () => ({claimIdentity: mockClaim}));
vi.mock('../../shared/contexts/SessionContext', () => ({useSession: () => mockSession}));

function wrapper({children}: {children: ReactNode}) {
  return <ProfileProvider>{children}</ProfileProvider>;
}
const render = () => renderHook(() => useProfile(), {wrapper});

const IDENTITY = {handle: 'emerald_princess_330', displayName: 'Emerald Princess 330'};

beforeEach(() => {
  vi.clearAllMocks();
  mockSession.user = null;
  mockClaim.mockResolvedValue({data: IDENTITY, error: null});
});

describe('ProfileProvider', () => {
  it('claims an identity once a user is present', async () => {
    mockSession.user = {id: 'u1'};
    const {result} = render();
    await waitFor(() => expect(result.current.identity).toEqual(IDENTITY));
    expect(result.current.loading).toBe(false);
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  it('does not call the RPC at all when signed out', async () => {
    const {result} = render();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.identity).toBeNull();
    expect(mockClaim).not.toHaveBeenCalled();
  });

  it('is loading while a signed-in user has no answer yet', () => {
    mockSession.user = {id: 'u1'};
    mockClaim.mockReturnValue(new Promise(() => {}));
    const {result} = render();
    expect(result.current.loading).toBe(true);
    expect(result.current.identity).toBeNull();
  });

  /*
    The reason the claim is stored keyed by user rather than as a bare value. Signing
    out has to drop the identity, and doing that by clearing state inside the effect is
    a synchronous setState the lint rule rejects — so it is DERIVED. Both rows below
    would catch a regression to the naive version, which leaves a stale name on screen
    for whoever arrives next. They differ only in what `loading` should settle to.
  */
  it.each([
    // Signed out. Nobody is waiting on a claim, so this must settle, not hang.
    ['the user signs out', null, {loading: false}],
    // A different user on the same machine. Their claim is in flight, so loading.
    ['a different user arrives', {id: 'u2'}, {loading: true}],
  ])('drops the identity when %s', async (_case, nextUser, expected) => {
    mockSession.user = {id: 'u1'};
    const {result, rerender} = render();
    await waitFor(() => expect(result.current.identity).toEqual(IDENTITY));

    mockClaim.mockReturnValue(new Promise(() => {}));
    mockSession.user = nextUser;
    rerender();

    expect(result.current.identity).toBeNull();
    expect(result.current.loading).toBe(expected.loading);
  });

  it('adopts a saved display name without refetching', async () => {
    mockSession.user = {id: 'u1'};
    const {result} = render();
    await waitFor(() => expect(result.current.identity).toEqual(IDENTITY));

    act(() => result.current.adoptDisplayName('Doberjohn'));
    expect(result.current.identity?.displayName).toBe('Doberjohn');
    // Renaming yourself changes what people READ. The unique identity underneath is
    // untouched, which is the whole point of the two-name split.
    expect(result.current.identity?.handle).toBe('emerald_princess_330');
    expect(mockClaim).toHaveBeenCalledTimes(1);
  });

  // Nothing to rename before the claim lands; the guard stops an adopt from
  // manufacturing an identity with an empty handle.
  it('ignores an adopt that arrives before the identity does', () => {
    mockSession.user = {id: 'u1'};
    mockClaim.mockReturnValue(new Promise(() => {}));
    const {result} = render();
    act(() => result.current.adoptDisplayName('Doberjohn'));
    expect(result.current.identity).toBeNull();
  });
});
