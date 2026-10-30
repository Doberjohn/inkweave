import {afterEach, describe, it, expect, vi, beforeEach} from 'vitest';
import type {Session} from '@supabase/auth-js';
import {callbackFailureReason} from '../signInAnalytics';

// Hoisted, so every fresh copy of the helpers sends through the same mock.
const {trackEvent} = vi.hoisted(() => ({trackEvent: vi.fn()}));
vi.mock('../analytics', () => ({trackEvent}));

/** The helpers read the accounts flag once, at load, so each case loads a fresh copy. */
async function loadHelpers(accounts: 'true' | 'false' = 'true') {
  vi.stubEnv('VITE_SHOW_ACCOUNTS', accounts);
  vi.resetModules();
  return import('../signInAnalytics');
}

function sessionFrom(provider: string): Session {
  return {
    user: {id: 'user-1', email: 'player@example.com', app_metadata: {provider}},
  } as unknown as Session;
}

describe('callbackFailureReason', () => {
  it.each([
    {url: {search: '', hash: '#error=access_denied&error_description=denied'}, reason: 'cancelled'},
    {url: {search: '?error=server_error', hash: ''}, reason: 'error'},
    {url: {search: '?code=abc', hash: ''}, reason: 'timeout'},
  ])('reads $reason from the callback URL', ({url, reason}) => {
    expect(callbackFailureReason(url)).toBe(reason);
  });
});

describe('sign-in events', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('completes a Google session as google, with no identity in the payload', async () => {
    const {trackSignInCompleted} = await loadHelpers();

    trackSignInCompleted(sessionFrom('google'));

    expect(trackEvent).toHaveBeenCalledWith('sign_in_completed', {provider: 'google'});
    const sent = JSON.stringify(trackEvent.mock.calls);
    expect(sent).not.toContain('user-1');
    expect(sent).not.toContain('player@example.com');
  });

  it('completes a session from any other provider as other', async () => {
    const {trackSignInCompleted} = await loadHelpers();

    trackSignInCompleted(sessionFrom('github'));

    expect(trackEvent).toHaveBeenCalledWith('sign_in_completed', {provider: 'other'});
  });

  it('forwards a start and a failure as given', async () => {
    const {trackSignInFailed, trackSignInStarted} = await loadHelpers();

    trackSignInStarted({provider: 'discord', surface: 'account'});
    trackSignInFailed({provider: null, stage: 'callback', reason: 'timeout'});

    expect(trackEvent).toHaveBeenCalledWith('sign_in_started', {
      provider: 'discord',
      surface: 'account',
    });
    expect(trackEvent).toHaveBeenCalledWith('sign_in_failed', {
      provider: null,
      stage: 'callback',
      reason: 'timeout',
    });
  });

  it('forwards the surface a shown dialog opened from', async () => {
    const {trackSignInShown} = await loadHelpers();

    trackSignInShown({surface: 'header'});

    expect(trackEvent).toHaveBeenCalledExactlyOnceWith('sign_in_shown', {surface: 'header'});
  });

  it('sends nothing while accounts are hidden, for a sign-in tried on /account by URL', async () => {
    const {trackSignInCompleted, trackSignInFailed, trackSignInShown, trackSignInStarted} = await loadHelpers('false');

    trackSignInShown({surface: 'account'});
    trackSignInStarted({provider: 'google', surface: 'account'});
    trackSignInCompleted(sessionFrom('google'));
    trackSignInFailed({provider: null, stage: 'callback', reason: 'timeout'});

    expect(trackEvent).not.toHaveBeenCalled();
  });
});
