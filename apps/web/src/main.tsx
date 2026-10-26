import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import 'react-loading-skeleton/dist/skeleton.css';
import 'inkweave-ui/styles/primitives.css';
import 'inkweave-ui/styles/lorcana.css';
import './index.css';
import {router} from './router';
import {HOLD_CAP_MS, holdPrerenderedPage} from './shared/lib/prerenderHold';
import {renderOverPrerenderedPage} from 'inkweave-ui/lib/prerenderedArt';
import {whenRouteReady} from './shared/lib/routeReadiness';
import {showUpdateToast} from './shared/lib/swUpdateToast';
import {reloadForStaleChunk} from './shared/lib/staleChunkReload';
import {loadSentryWhenIdle} from './shared/lib/sentry';
import {loadPostHogWhenIdle} from './shared/lib/posthog';

// Recover from stale-deploy chunk mismatches. After a new deploy, a tab still
// running the old bundle references hashed CSS/JS chunks the deploy has purged;
// Vite fires a cancelable `vite:preloadError` and re-throws unless we cancel it
// (that re-throw is what spammed Sentry). preventDefault() silences it at the
// source, then we reload onto the fresh deploy (loop-guarded). Cancelled, the
// failed import resolves empty instead of rejecting; lazyWithRetry handles that.
if (import.meta.env.PROD) {
  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault();
    reloadForStaleChunk();
  });
}

// Sentry and PostHog load after `load`, off the critical path (#640, #827); see
// shared/lib/sentry.ts and shared/lib/posthog.ts.
loadSentryWhenIdle();
loadPostHogWhenIdle();

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
 * Runs when the app starts to render, not while a prerendered page is held (#915), so a held
 * page keeps its metadata. Nothing samples the document in the brief gap before React's first
 * commit adds the app's own tags.
 */
function sweepPrerenderedSeoTags() {
  for (const tag of document.head.querySelectorAll('[data-seo]')) {
    tag.remove();
  }
}

const rootElement = document.getElementById('root')!;

function renderApp() {
  // index.html hides a prerendered page until its inline script approves it (#915). Had that
  // script failed, the mark would hide the app too, so it goes before React renders.
  rootElement.removeAttribute('data-prerender-route');
  sweepPrerenderedSeoTags();
  const root = createRoot(rootElement);
  renderOverPrerenderedPage(rootElement, () =>
    root.render(
      <StrictMode>
        <RouterProvider router={router} />
      </StrictMode>,
    ),
  );
}

// Only a page the inline script approved is held (#915); an emptied or unapproved root renders
// at once.
if (rootElement.hasAttribute('data-ready') && HOLD_CAP_MS > 0) {
  holdPrerenderedPage(whenRouteReady(router.routes, window.location.pathname), renderApp);
} else {
  renderApp();
}
