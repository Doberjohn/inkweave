import {lazy, Suspense} from 'react';
import {createBrowserRouter} from 'react-router-dom';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {AppLayout} from './AppLayout';
import {RevealsGate} from './features/reveals';
import {COLORS, RADIUS, SPACING} from './shared/constants';

/** Retry a dynamic import up to `retries` times, then force-reload on stale chunks (e.g. iOS home screen cache). */
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
          // All retries exhausted. Likely stale chunks after deploy.
          // Force reload to fetch new index.html with current chunk hashes.
          // Guard against reload loops with a sessionStorage flag.
          const reloadKey = 'chunk-reload';
          if (!sessionStorage.getItem(reloadKey)) {
            sessionStorage.setItem(reloadKey, '1');
            window.location.reload();
          }
          throw err;
        });
    return load(0);
  });
}

// Lazy-load page components for code splitting (with retry on chunk load failure)
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
const BrowsePage = lazyWithRetry(() => import('./pages/BrowsePage'), 'BrowsePage');
const CardPage = lazyWithRetry(() => import('./pages/CardPage'), 'CardPage');
const PlaystyleGalleryPage = lazyWithRetry(
  () => import('./pages/PlaystyleGalleryPage'),
  'PlaystyleGalleryPage',
);
const PlaystyleDetailPage = lazyWithRetry(
  () => import('./pages/PlaystyleDetailPage'),
  'PlaystyleDetailPage',
);
const VotePage = lazyWithRetry(() => import('./pages/VotePage'), 'VotePage');
const InDepthVotePage = lazyWithRetry(
  () => import('./pages/InDepthVotePage'),
  'InDepthVotePage',
);
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const RevealsPage = lazyWithRetry(() => import('./pages/RevealsPage'), 'RevealsPage');

function SuspenseWrapper({children}: {children: React.ReactNode}) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: '100vh',
            background: COLORS.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: SPACING.xl,
          }}
          aria-busy="true"
          aria-label="Loading page">
          <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: SPACING.md,
                width: '100%',
                maxWidth: 320,
              }}>
              <Skeleton width="60%" height={24} borderRadius={RADIUS.sm} />
              <Skeleton height={12} borderRadius={RADIUS.sm} />
              <Skeleton height={12} width="80%" borderRadius={RADIUS.sm} />
              <Skeleton height={12} width="40%" borderRadius={RADIUS.sm} />
            </div>
          </SkeletonTheme>
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
      {
        index: true,
        element: (
          <SuspenseWrapper>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'browse',
        element: (
          <SuspenseWrapper>
            <BrowsePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'card/:cardId',
        element: (
          <SuspenseWrapper>
            <CardPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'playstyles',
        element: (
          <SuspenseWrapper>
            <PlaystyleGalleryPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'playstyles/:playstyleId',
        element: (
          <SuspenseWrapper>
            <PlaystyleDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'vote',
        element: (
          <SuspenseWrapper>
            <VotePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'vote/:cardAId/:cardBId',
        element: (
          <SuspenseWrapper>
            <InDepthVotePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'reveals',
        element: (
          <RevealsGate>
            <SuspenseWrapper>
              <RevealsPage />
            </SuspenseWrapper>
          </RevealsGate>
        ),
      },
      {
        path: '*',
        element: (
          <SuspenseWrapper>
            <NotFoundPage />
          </SuspenseWrapper>
        ),
      },
    ],
  },
]);
