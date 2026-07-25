import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import 'react-loading-skeleton/dist/skeleton.css';
import './index.css';
import {router} from './router';
import {showUpdateToast} from './shared/lib/swUpdateToast';
import {reloadForStaleChunk} from './shared/lib/staleChunkReload';

// Recover from stale-deploy chunk mismatches. After a new deploy, a tab still
// running the old bundle references hashed CSS/JS chunks the deploy has purged;
// Vite fires a cancelable `vite:preloadError` and re-throws unless we cancel it
// (that re-throw is what spammed Sentry). preventDefault() silences it at the
// source, then we reload onto the fresh deploy (loop-guarded).
if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForStaleChunk();
  });
}

// Lazy-load Sentry to keep it off the critical path (~150 KB gzip)
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then(async (Sentry) => {
    // Widen the array so both browserTracing and supabase integrations fit. A
    // prior `ReturnType<typeof Sentry.supabaseIntegration>[]` annotation stopped
    // widening once @sentry/react 10.67 narrowed supabaseIntegration()'s `name`
    // to the literal "Supabase" (TS2322 on push). @sentry/react doesn't re-export
    // the base `Integration` type, so union the two integration return types.
    const integrations: (
      | ReturnType<typeof Sentry.browserTracingIntegration>
      | ReturnType<typeof Sentry.supabaseIntegration>
    )[] = [Sentry.browserTracingIntegration()];

    // Add Supabase monitoring when configured. supabaseIntegration (v10) takes the
    // SupabaseClient constructor so it can instrument every client instance; lazily
    // imported here to keep @supabase/supabase-js off the critical path.
    if (import.meta.env.VITE_SUPABASE_URL) {
      const {SupabaseClient} = await import('@supabase/supabase-js');
      integrations.push(Sentry.supabaseIntegration({supabaseClient: SupabaseClient}));
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: 'production',
      integrations,
      tracesSampleRate: 0.1,
      // Stale-deploy chunk mismatches are auto-recovered via reload (see the
      // vite:preloadError handler above), so they're noise, not bugs. Drop the
      // whole family — the preload re-throw plus the dynamic-import variants.
      ignoreErrors: [
        'Unable to preload CSS',
        'Failed to fetch dynamically imported module',
        'Importing a module script failed',
        'error loading dynamically imported module',
      ],
    });
  });
}

// Register service worker with auto-update flow: when a new SW reaches
// `waiting` state, show a bottom-right toast for ~600ms so the user sees the
// version swap, then activate + reload automatically.
if (import.meta.env.PROD) {
  // Backstop reload: fire exactly once when a new SW takes control. workbox-
  // window's built-in controlling-reload only covers updates it initiated via
  // updateSW(); this also catches a wedged `waiting` worker activated by the
  // direct SKIP_WAITING message below. `hadController` gates out the first-ever
  // install (no prior controller), which would otherwise spuriously reload a
  // user's very first visit.
  if ('serviceWorker' in navigator) {
    const hadController = Boolean(navigator.serviceWorker.controller);
    let reloaded = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloaded) return;
      reloaded = true;
      window.location.reload();
    });
  }

  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateToast();
      window.setTimeout(() => {
        void updateSW(true);
        // Backstop for a wedged `waiting` worker that updateSW() doesn't
        // activate: message it directly so it calls skipWaiting() and fires
        // `controllerchange` (handled above). skipWaiting is idempotent, so
        // overlapping with updateSW(true) is harmless.
        if ('serviceWorker' in navigator) {
          void navigator.serviceWorker.getRegistration().then((reg) => {
            reg?.waiting?.postMessage({type: 'SKIP_WAITING'});
          });
        }
      }, 600);
    },
    onOfflineReady() {
      console.log('Inkweave is ready for offline use');
    },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
