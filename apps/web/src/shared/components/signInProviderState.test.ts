import {describe, it, expect} from 'vitest';
import {signInProviderButtonState, type SignInProvider} from './signInProviderState';

const google: SignInProvider = {id: 'google', label: 'Continue with Google'};

describe('signInProviderButtonState', () => {
  it('is active (enabled, full opacity, pointer) when auth is enabled and idle', () => {
    expect(signInProviderButtonState(google, true, null)).toEqual({
      disabled: false,
      label: 'Continue with Google',
      cursor: 'pointer',
      opacity: 1,
    });
  });

  it('disables and dims every button while a redirect is in flight', () => {
    const state = signInProviderButtonState(google, true, 'discord');
    expect(state.disabled).toBe(true);
    expect(state.cursor).toBe('default');
    expect(state.opacity).toBe(0.6);
  });

  it('shows the redirecting label only for the provider whose redirect is in flight', () => {
    expect(signInProviderButtonState(google, true, 'google').label).toBe('Redirecting…');
    expect(signInProviderButtonState(google, true, 'discord').label).toBe('Continue with Google');
  });

  it('is disabled when auth is not configured, even while idle', () => {
    expect(signInProviderButtonState(google, false, null).disabled).toBe(true);
  });
});
