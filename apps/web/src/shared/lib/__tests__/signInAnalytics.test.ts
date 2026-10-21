import {describe, it, expect, vi, beforeEach} from 'vitest';
import type {Session} from '@supabase/supabase-js';
import {
  callbackFailureReason,
  trackSignInCompleted,
  trackSignInFailed,
  trackSignInStarted,
} from '../signInAnalytics';
import {trackEvent} from '../analytics';

vi.mock('../analytics', () => ({trackEvent: vi.fn()}));

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

  it('completes a Google session as google, with no identity in the payload', () => {
    trackSignInCompleted(sessionFrom('google'));

    expect(trackEvent).toHaveBeenCalledWith('sign_in_completed', {provider: 'google'});
    const sent = JSON.stringify(vi.mocked(trackEvent).mock.calls);
    expect(sent).not.toContain('user-1');
    expect(sent).not.toContain('player@example.com');
  });

  it('completes a session from any other provider as other', () => {
    trackSignInCompleted(sessionFrom('github'));

    expect(trackEvent).toHaveBeenCalledWith('sign_in_completed', {provider: 'other'});
  });

  it('forwards a start and a failure as given', () => {
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
});
