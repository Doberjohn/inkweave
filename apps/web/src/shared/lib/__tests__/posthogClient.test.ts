import {describe, it, expect, vi, afterEach} from 'vitest';
import {FRIEND_PARAM} from '../../../features/collection/binderCards';

afterEach(() => {
  vi.doUnmock('posthog-js');
  vi.unstubAllGlobals();
  window.history.replaceState(null, '', '/');
});

describe('startPostHog', () => {
  // The real SDK, started the way the app starts it: an option dropped from posthogClient.ts, or
  // an SDK upgrade that starts writing to the visitor's device or sending past the relay, fails
  // here instead of in production.
  it('writes nothing to cookies or storage, and sends only to the relay', async () => {
    const sent: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string | URL) => {
        sent.push(String(url));
        return new Response('{"status":1}');
      }),
    );
    vi.resetModules();
    const {startPostHog} = await import('../posthogClient');

    // A timestamp sends the event at once instead of batching it for later.
    startPostHog('phc_test', () => {})?.capture(
      'search_submitted',
      {query: 'elsa', source: 'home'},
      new Date(),
    );

    await vi.waitFor(() => expect(sent.length).toBeGreaterThan(0));
    expect(document.cookie).toBe('');
    expect(localStorage.length).toBe(0);
    expect(sessionStorage.length).toBe(0);
    // Same origin and through the relay: any other host would need a CSP change.
    const relay = `${location.origin}/relay/`;
    expect(sent.filter((url) => !new URL(url, location.href).href.startsWith(relay))).toEqual([]);
  });

  // A friend's binder names the friend in its address, and a failed sign-in leaves its one-time
  // code there: neither may reach PostHog in the address every event carries.
  it('masks a friend handle and a sign-in code in the address of every event', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{"status":1}')));
    window.history.replaceState(null, '', `/browse?binder=all&${FRIEND_PARAM}=ruby_hero_042&code=4f2a9c`);
    vi.resetModules();
    const {startPostHog} = await import('../posthogClient');
    startPostHog('phc_test', () => {});
    const {default: posthog} = await import('posthog-js');

    const url = String(posthog.capture('probe', {})?.properties.$current_url);

    expect(url).not.toContain('ruby_hero_042');
    expect(url).not.toContain('4f2a9c');
    expect(new URL(url).searchParams.get(FRIEND_PARAM)).toBe('<masked>');
  });

  it('returns null, never a throw, when the SDK fails to start, and hands over the error', async () => {
    const failure = new Error('init broke');
    const onError = vi.fn();
    vi.resetModules();
    vi.doMock('posthog-js', () => ({
      default: {
        init: () => {
          throw failure;
        },
      },
    }));
    const {startPostHog} = await import('../posthogClient');

    expect(startPostHog('phc_test', onError)).toBeNull();
    expect(onError).toHaveBeenCalledExactlyOnceWith(failure);
  });
});
