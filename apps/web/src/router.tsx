import {lazy, Suspense} from 'react';
import {createBrowserRouter, Navigate} from 'react-router-dom';
import Skeleton, {SkeletonTheme} from 'react-loading-skeleton';
import {AppLayout} from './AppLayout';
import {AdminGate} from './features/admin-analytics/AdminGate';
import {RevealsGate} from './features/reveals';
import {HomePageSkeleton} from './pages/HomePageSkeleton';
import {COLORS, RADIUS, SPACING} from './shared/constants';
import {reloadForStaleChunk} from './shared/lib/staleChunkReload';

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
          // All retries exhausted. Likely stale chunks after deploy — reload to
          // fetch a new index.html with current chunk hashes (loop-guarded).
          reloadForStaleChunk();
          throw err;
        });
    return load(0);
  });
}

// Lazy-load page components for code splitting (with retry on chunk load failure)
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
const BrowsePage = lazyWithRetry(() => import('./pages/BrowsePage'), 'BrowsePage');
const CardPage = lazyWithRetry(() => import('./pages/CardPage'), 'CardPage');
const ComparePage = lazyWithRetry(() => import('./pages/ComparePage'), 'ComparePage');
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
const RevealAdminPage = lazyWithRetry(() => import('./pages/RevealAdminPage'), 'RevealAdminPage');
const AdminAnalyticsPage = lazyWithRetry(
  () => import('./pages/AdminAnalyticsPage'),
  'AdminAnalyticsPage',
);

/** Generic 3-line fallback used by every route except `/`. */
function GenericFallback() {
  return (
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
  );
}

function SuspenseWrapper({children, fallback}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  return <Suspense fallback={fallback ?? <GenericFallback />}>{children}</Suspense>;
}

export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        element: (
          <SuspenseWrapper fallback={<HomePageSkeleton />}>
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
        path: 'compare/:idA/:idB',
        element: (
          <SuspenseWrapper>
            <ComparePage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'compare/:idA/:idB/:groupKey',
        element: (
          <SuspenseWrapper>
            <ComparePage />
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
        // Redirect the pre-rebrand Vinelings path to the renamed Floodborns playstyle.
        path: 'playstyles/vinelings',
        element: <Navigate to="/playstyles/floodborn" replace />,
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
        path: 'reveal-admin',
        element: (
          <SuspenseWrapper>
            <RevealAdminPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/analytics',
        element: (
          <AdminGate>
            <SuspenseWrapper>
              <AdminAnalyticsPage />
            </SuspenseWrapper>
          </AdminGate>
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
