import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import 'react-loading-skeleton/dist/skeleton.css';
import './index.css';
import {router} from './router';
import {showUpdateToast} from './shared/lib/swUpdateToast';
import {reloadForStaleChunk} from './shared/lib/staleChunkReload';
import {loadSentryWhenIdle} from './shared/lib/sentry';

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

// Sentry loads after `load`, off the critical path (#640); see shared/lib/sentry.ts.
loadSentryWhenIdle();

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

/**
 * Drop the prerendered copies of <Seo>'s tags before React renders (#535).
 *
 * The prerender crawl bakes React's hoisted metadata into the static HTML. On a real
 * visit those tags are already in <head> as plain markup, React does not recognise them
 * as its own, and it hoists a second copy — measured at title/description/canonical
 * 1 -> 2, og 8 -> 11, twitter 4 -> 6 on EVERY route. Two <link rel="canonical"> is the
 * costly one: Google resolves the conflict by ignoring canonicalisation altogether.
 *
 * Scoped by `[data-seo]`, which only <Seo> emits, so index.html's site-level constants
 * (og:type, og:image:width/height, og:locale, twitter:card) are left alone — those are
 * not duplicated and must survive.
 *
 * Runs before render, so the brief gap with no metadata coincides with the gap where
 * createRoot has emptied #root anyway. Nothing samples the document in between.
 */
function sweepPrerenderedSeoTags() {
  for (const tag of document.head.querySelectorAll('[data-seo]')) {
    tag.remove();
  }
}

sweepPrerenderedSeoTags();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
