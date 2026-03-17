import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import {RouterProvider} from 'react-router-dom';
import {registerSW} from 'virtual:pwa-register';
import './index.css';
import {router} from './router';

// Lazy-load Sentry to keep it off the critical path (~150 KB gzip)
if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
  import('@sentry/react').then((Sentry) => {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      environment: 'production',
      tracesSampleRate: 0.1,
    });
  });
}

// Register service worker with update prompt
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      const banner = document.createElement('div');
      banner.setAttribute('role', 'alert');
      banner.style.cssText =
        'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:#1a1a2e;color:#e8e8e8;padding:12px 20px;border-radius:8px;border:1px solid #333355;display:flex;align-items:center;gap:12px;z-index:9999;font-family:Inter,sans-serif;font-size:13px;box-shadow:0 4px 12px rgba(0,0,0,0.5)';

      const label = document.createElement('span');
      label.textContent = 'New version available';

      const updateBtn = document.createElement('button');
      updateBtn.textContent = 'Update';
      updateBtn.style.cssText =
        'background:#d4af37;color:#0d0d14;border:none;padding:6px 14px;border-radius:4px;cursor:pointer;font-weight:600;font-size:13px';
      updateBtn.onclick = () => window.__updateSW?.(true);

      const dismissBtn = document.createElement('button');
      dismissBtn.textContent = '\u00d7';
      dismissBtn.setAttribute('aria-label', 'Dismiss update notification');
      dismissBtn.style.cssText =
        'background:none;border:none;color:#90a1b9;cursor:pointer;font-size:16px';
      dismissBtn.onclick = () => banner.remove();

      banner.append(label, updateBtn, dismissBtn);
      document.body.appendChild(banner);
    },
    onOfflineReady() {
      console.log('Inkweave is ready for offline use');
    },
  });

  // Expose for the update notification to call
  window.__updateSW = updateSW;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
