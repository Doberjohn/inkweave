import {lazy, Suspense} from 'react';
import {createBrowserRouter, Navigate} from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
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
const InkHubPage = lazyWithRetry(() => import('./pages/InkHubPage'), 'InkHubPage');
const InkGalleryPage = lazyWithRetry(() => import('./pages/InkGalleryPage'), 'InkGalleryPage');
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const RevealsPage = lazyWithRetry(() => import('./pages/RevealsPage'), 'RevealsPage');
const RevealAdminPage = lazyWithRetry(() => import('./pages/RevealAdminPage'), 'RevealAdminPage');
const ImageAdminPage = lazyWithRetry(() => import('./pages/ImageAdminPage'), 'ImageAdminPage');
const TuningAdminPage = lazyWithRetry(
  () => import('./pages/TuningAdminPage'),
  'TuningAdminPage',
);
const AdminAnalyticsPage = lazyWithRetry(
  () => import('./pages/AdminAnalyticsPage'),
  'AdminAnalyticsPage',
);
const DeckLayout = lazyWithRetry(() => import('./pages/DeckLayout'), 'DeckLayout');
const DecksPage = lazyWithRetry(() => import('./pages/DecksPage'), 'DecksPage');
const DeckBuilderPage = lazyWithRetry(() => import('./pages/DeckBuilderPage'), 'DeckBuilderPage');
const DeckViewPage = lazyWithRetry(() => import('./pages/DeckViewPage'), 'DeckViewPage');
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage'), 'AuthCallbackPage');
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage'), 'TermsPage');
const DisclaimerPage = lazyWithRetry(() => import('./pages/DisclaimerPage'), 'DisclaimerPage');
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'), 'AboutPage');
// Dev-only: the /banner marketing-image generator exists solely for `pnpm banner`, which runs
// against the Vite dev server. Gating the dynamic import behind import.meta.env.DEV lets the
// production build tree-shake BannerPage (and SynergyBanner) out of the bundle entirely.
const BannerPage = import.meta.env.DEV
  ? lazyWithRetry(() => import('./pages/BannerPage'), 'BannerPage')
  : null;

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
      <>
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
      </>
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
        // Slug URL (#498). CardPage looks the card up by :cardId; :slug is decorative and
        // canonicalizes to cardPath(). A wrong or absent slug still renders the right card.
        path: 'card/:cardId/:slug',
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
        // Parent of the six hubs (#530) — the breadcrumb on every hub resolves here.
        path: 'inks',
        element: (
          <SuspenseWrapper>
            <InkGalleryPage />
          </SuspenseWrapper>
        ),
      },
      {
        // Six ink hub pages (#530). Ink is the only total partition of the corpus, so these
        // guarantee every card an inbound crawlable link independent of the sitemap.
        path: 'ink/:inkSlug',
        element: (
          <SuspenseWrapper>
            <InkHubPage />
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
        path: 'admin/reveal',
        element: (
          <SuspenseWrapper>
            <RevealAdminPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/image',
        element: (
          <SuspenseWrapper>
            <ImageAdminPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'admin/tuning',
        element: (
          <SuspenseWrapper>
            <TuningAdminPage />
          </SuspenseWrapper>
        ),
      },
      {
        // Preserve old bookmarks / the scan-reveal-card workflow.
        path: 'reveal-admin',
        element: <Navigate to="/admin/reveal" replace />,
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
        // The deck builder subtree. The layout element mounts DeckProvider (under
        // CardDataProvider) so one working draft is shared across list/builder/view.
        path: 'decks',
        element: (
          <SuspenseWrapper>
            <DeckLayout />
          </SuspenseWrapper>
        ),
        children: [
          {
            index: true,
            element: (
              <SuspenseWrapper>
                <DecksPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: 'new',
            element: (
              <SuspenseWrapper>
                <DeckBuilderPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: ':id',
            element: (
              <SuspenseWrapper>
                <DeckViewPage />
              </SuspenseWrapper>
            ),
          },
          {
            path: ':id/edit',
            element: (
              <SuspenseWrapper>
                <DeckBuilderPage />
              </SuspenseWrapper>
            ),
          },
        ],
      },
      {
        path: 'auth/callback',
        element: (
          <SuspenseWrapper>
            <AuthCallbackPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'privacy',
        element: (
          <SuspenseWrapper>
            <PrivacyPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'terms',
        element: (
          <SuspenseWrapper>
            <TermsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'disclaimer',
        element: (
          <SuspenseWrapper>
            <DisclaimerPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'about',
        element: (
          <SuspenseWrapper>
            <AboutPage />
          </SuspenseWrapper>
        ),
      },
      ...(BannerPage
        ? [
            {
              path: 'banner/:cardId',
              element: (
                <SuspenseWrapper>
                  <BannerPage />
                </SuspenseWrapper>
              ),
            },
          ]
        : []),
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
