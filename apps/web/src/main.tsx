import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import 'react-loading-skeleton/dist/skeleton.css';
import './index.css';
import {router} from './router';
import {showUpdateToast} from './shared/lib/swUpdateToast';

// Lazy-load Sentry to keep it off the critical path (~150 KB gzip)
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    const integrations = [Sentry.browserTracingIntegration()];

    // Add Supabase monitoring when configured
    if (import.meta.env.VITE_SUPABASE_URL) {
      integrations.push(
        Sentry.supabaseIntegration({
          breadcrumbs: true,
          tracing: true,
        }),
      );
    }

    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: 'production',
      integrations,
      tracesSampleRate: 0.1,
    });
  });
}

// Register service worker with auto-update flow: when a new SW reaches
// `waiting` state, show a bottom-right toast for ~600ms so the user sees the
// version swap, then activate + reload automatically.
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      showUpdateToast();
      window.setTimeout(() => {
        void updateSW(true);
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
