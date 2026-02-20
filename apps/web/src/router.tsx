import {lazy, Suspense} from 'react';
import {createBrowserRouter} from 'react-router-dom';
import {AppLayout} from './AppLayout';
import {LoadingSpinner} from './shared/components';

/** Retry a dynamic import up to `retries` times before giving up. Handles stale chunk hashes after deploys. */
function lazyWithRetry(
  importFn: () => Promise<{[key: string]: React.ComponentType}>,
  exportName: string,
  retries = 2,
) {
  return lazy(() => {
    const load = (attempt: number): Promise<{default: React.ComponentType}> =>
      importFn()
        .then((m) => ({default: m[exportName]}))
        .catch((err) => {
          if (attempt < retries) return load(attempt + 1);
          throw err;
        });
    return load(0);
  });
}

// Lazy-load page components for code splitting (with retry on chunk load failure)
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
const BrowsePage = lazyWithRetry(() => import('./pages/BrowsePage'), 'BrowsePage');
const CardPage = lazyWithRetry(() => import('./pages/CardPage'), 'CardPage');
const CardSynergiesPage = lazyWithRetry(() => import('./pages/CardSynergiesPage'), 'CardSynergiesPage');
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');

function SuspenseWrapper({children}: {children: React.ReactNode}) {
  return (
    <Suspense
      fallback={
        <div style={{minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center'}}>
          <LoadingSpinner />
        </div>
      }>
      {children}
    </Suspense>
  );
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {index: true, element: <SuspenseWrapper><HomePage /></SuspenseWrapper>},
      {path: 'browse', element: <SuspenseWrapper><BrowsePage /></SuspenseWrapper>},
      {path: 'card/:cardId', element: <SuspenseWrapper><CardPage /></SuspenseWrapper>},
      {path: 'card/:cardId/synergies', element: <SuspenseWrapper><CardSynergiesPage /></SuspenseWrapper>},
      {path: '*', element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper>},
    ],
  },
]);
