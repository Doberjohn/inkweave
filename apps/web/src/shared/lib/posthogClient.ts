// The only module that imports posthog-js as a value (#827). posthog.ts reaches it through a
// dynamic import, so the SDK ships in this module's own chunk, `posthogClient-*.js`, which the
// root package.json gives its own size budget. Import it statically from anywhere else and the
// SDK lands in the startup chunks.
import posthog from 'posthog-js';

/** The property values Vercel accepts, whose limits bind PostHog's events too (analytics.ts). */
export type EventProperties = Record<string, string | number | boolean | null>;

export interface PostHogApi {
  /** With a timestamp (an event that waited for the SDK), the event skips the SDK's batching. */
  capture(event: string, properties: EventProperties, timestamp?: Date): void;
}

/**
 * Starts PostHog. Returns null when the SDK fails to start, handing the error to `onError`, and
 * never throws: this runs inside Vite's preload wrapper, where a throw becomes a page reload
 * (see posthog.ts). It imports nothing from the app, which would reshape the startup chunks.
 */
export function startPostHog(key: string, onError: (error: unknown) => void): PostHogApi | null {
  try {
    posthog.init(key, {
      // Same-origin, through vercel.json's /relay rewrite to PostHog's EU cloud, so the CSP's
      // connect-src stays 'self'.
      api_host: '/relay',
      ui_host: 'https://eu.posthog.com',
      defaults: '2026-08-30',
      // No cookies, localStorage or sessionStorage. PostHog links a visit with a hash it computes
      // on its servers from a salt it deletes daily, then strips the IP. The project needs
      // "Cookieless tracking" turned on (formerly "Cookieless server hash mode"), or PostHog drops
      // every event, and should discard client IP data. Never call identify() in this mode.
      cookieless_mode: 'always',
      // The SDK's console logging stays off even with ?__posthog_debug=true in the URL, which
      // would otherwise switch it on and store a ph_debug flag in localStorage.
      debug: false,
      // Masks a sign-in's one-time code, and ad-click ids such as gclid and fbclid, in each event's
      // URL and the visit's first URL. supabase-js clears the code from the address bar only after
      // a successful exchange, so a failed sign-in leaves it there. Referrers are not masked.
      mask_personal_data_properties: true,
      custom_personal_data_properties: ['code'],
      // Decided here, never in PostHog's settings: with remote config off, nobody can switch on
      // replays, surveys or extra scripts from the dashboard. Each needs a code change and a
      // privacy page update.
      advanced_disable_flags: true,
      disable_external_dependency_loading: true,
      disable_session_recording: true,
      disable_surveys: true,
      capture_exceptions: false, // Sentry reports errors
      capture_performance: false, // Speed Insights measures speed
    });
  } catch (error) {
    onError(error);
    return null;
  }
  return {
    capture: (event, properties, timestamp) => {
      // Options without a _batchKey skip the SDK's batching, so only an event that waited
      // passes them.
      posthog.capture(event, properties, timestamp && {timestamp});
    },
  };
}
