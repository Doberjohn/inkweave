import {Suspense} from 'react';
import {createBrowserRouter, Navigate, type Params, type RouteObject} from 'react-router-dom';
import Skeleton from 'react-loading-skeleton';
import {AppLayout} from './AppLayout';
import {RevealsGate} from './features/reveals';
import {HomePageSkeleton} from './pages/HomePageSkeleton';
import {COLORS, RADIUS, SPACING} from './shared/constants';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';
import {lazyWithRetry} from './shared/lib/lazyWithRetry';
import {forgetArtOnLeave} from 'inkweave-ui/lib/prerenderedArt';
import {readyWhen} from './shared/lib/routeReadiness';
import {withSpeedInsightsRoutes} from './shared/lib/speedInsightsRoute';
import {SHOW_COLLECTION} from './features/collection/flag';
import {startCardList} from './features/cards/cardListRequest';
import {startFeaturedCards} from './features/cards/featured';
import {fetchCardSynergies} from './features/synergies/hooks/usePrecomputedSynergies';
import {
  fetchPlaystyleCardIds,
  fetchPlaystyleGuides,
  fetchPlaystyleMechanicIds,
} from './features/synergies/hooks/playstyleFiles';
import {fetchPairsIndex} from './features/voting/pairsIndexRequest';

// Lazy-load page components for code splitting (with retry on chunk load failure)
const HomePage = lazyWithRetry(() => import('./pages/HomePage'), 'HomePage');
// The flag picks Browse's page module (#553 Phase C), so a flag-off build never loads the
// collection feature on /browse. See BrowsePage for why one module cannot choose.
const BrowsePage = SHOW_COLLECTION
  ? lazyWithRetry(() => import('./pages/BrowseCollectionPage'), 'BrowseCollectionPage')
  : lazyWithRetry(() => import('./pages/BrowsePage'), 'BrowsePage');
const AccountPage = lazyWithRetry(() => import('./pages/AccountPage'), 'AccountPage');
// Behind the flag too, so a flag-off build names none of the collection's chunks and its service
// worker precaches none of them (#928). The build fails if one can load (collectionCodeGuard).
const CollectionScope = SHOW_COLLECTION
  ? lazyWithRetry(() => import('./features/collection/CollectionScope'), 'CollectionScope')
  : null;
const AuthCallbackPage = lazyWithRetry(() => import('./pages/AuthCallbackPage'), 'AuthCallbackPage');
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
const votePageChunk = () => import('./pages/votePageChunk');
const VotePage = lazyWithRetry(votePageChunk, 'VotePage');
const InDepthVotePage = lazyWithRetry(
  () => import('./pages/InDepthVotePage'),
  'InDepthVotePage',
);
const InkHubPage = lazyWithRetry(() => import('./pages/InkHubPage'), 'InkHubPage');
const InkGalleryPage = lazyWithRetry(() => import('./pages/InkGalleryPage'), 'InkGalleryPage');
const NotFoundPage = lazyWithRetry(() => import('./pages/NotFoundPage'), 'NotFoundPage');
const RevealsPage = lazyWithRetry(() => import('./pages/RevealsPage'), 'RevealsPage');
const PrivacyPage = lazyWithRetry(() => import('./pages/PrivacyPage'), 'PrivacyPage');
const TermsPage = lazyWithRetry(() => import('./pages/TermsPage'), 'TermsPage');
const DisclaimerPage = lazyWithRetry(() => import('./pages/DisclaimerPage'), 'DisclaimerPage');
const AboutPage = lazyWithRetry(() => import('./pages/AboutPage'), 'AboutPage');
const ReleaseNotesPage = lazyWithRetry(
  () => import('./pages/ReleaseNotesPage'),
  'ReleaseNotesPage',
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

/** The `/` fallback, in the layout HomePage will use: a phone gets the phone skeleton (#914). */
function HomeFallback() {
  const {isMobile} = useResponsive();
  return <HomePageSkeleton isMobile={isMobile} />;
}

function SuspenseWrapper({children, fallback}: {children: React.ReactNode; fallback?: React.ReactNode}) {
  return <Suspense fallback={fallback ?? <GenericFallback />}>{children}</Suspense>;
}

/** The card page's synergy file, which its groups render from. */
const cardSynergies = ({cardId}: Params) =>
  cardId ? fetchCardSynergies(cardId) : Promise.resolve();

/** The vote page's first pair, drawn for the visit while main.tsx holds the page (#915). */
const firstVotePair = () => votePageChunk().then((chunk) => chunk.startFirstPair());

/**
 * `/browse` and `/account` under the collection layout route while `SHOW_COLLECTION`
 * is on, and as plain siblings otherwise, so a dark feature adds nothing to either.
 * See `CollectionScope` for why the providers mount here and not in `AppLayout`.
 */
function withCollectionScope(children: RouteObject[]): RouteObject[] {
  if (!CollectionScope) return children;
  return [
    {
      element: (
        <SuspenseWrapper>
          <CollectionScope />
        </SuspenseWrapper>
      ),
      handle: readyWhen(CollectionScope),
      children,
    },
  ];
}

const routes: RouteObject[] = [
  {
    path: '/',
    element: <AppLayout />,
    children: [
      {
        index: true,
        handle: readyWhen(HomePage, startFeaturedCards),
        element: (
          <SuspenseWrapper fallback={<HomeFallback />}>
            <HomePage />
          </SuspenseWrapper>
        ),
      },
      ...withCollectionScope([
        {
          path: 'browse',
          handle: readyWhen(BrowsePage, startCardList),
          element: (
            <SuspenseWrapper>
              <BrowsePage />
            </SuspenseWrapper>
          ),
        },
        {
          // Private account settings. NOT gated by a route guard: the page renders
          // its own sign-in prompt, because a redirect would discard the URL and
          // make a shared or bookmarked /account link look broken rather than gated.
          path: 'account',
          element: (
            <SuspenseWrapper>
              <AccountPage />
            </SuspenseWrapper>
          ),
        },
      ]),
      {
        path: 'card/:cardId',
        handle: readyWhen(CardPage, startCardList, cardSynergies),
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
        handle: readyWhen(CardPage, startCardList, cardSynergies),
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
        handle: readyWhen(InkGalleryPage, startCardList),
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
        handle: readyWhen(InkHubPage, startCardList),
        element: (
          <SuspenseWrapper>
            <InkHubPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'playstyles',
        handle: readyWhen(PlaystyleGalleryPage, startCardList, fetchPlaystyleCardIds),
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
        // Its mechanic ids and the guides too: the page draws its cards, their tiles and its
        // guide in one render (#930, #995).
        handle: readyWhen(
          PlaystyleDetailPage,
          startCardList,
          fetchPlaystyleCardIds,
          fetchPlaystyleMechanicIds,
          fetchPlaystyleGuides,
        ),
        element: (
          <SuspenseWrapper>
            <PlaystyleDetailPage />
          </SuspenseWrapper>
        ),
      },
      {
        // Held until the visit's own first pair is drawn (#915). The crawl draws none, so the
        // capture shows the page loading, never a pair the visitor can't vote on.
        path: 'vote',
        handle: readyWhen(VotePage, startCardList, fetchPairsIndex, firstVotePair),
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
        handle: readyWhen(RevealsPage, startCardList),
        element: (
          <RevealsGate>
            <SuspenseWrapper>
              <RevealsPage />
            </SuspenseWrapper>
          </RevealsGate>
        ),
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
        handle: readyWhen(PrivacyPage),
        element: (
          <SuspenseWrapper>
            <PrivacyPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'terms',
        handle: readyWhen(TermsPage),
        element: (
          <SuspenseWrapper>
            <TermsPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'disclaimer',
        handle: readyWhen(DisclaimerPage),
        element: (
          <SuspenseWrapper>
            <DisclaimerPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'about',
        handle: readyWhen(AboutPage),
        element: (
          <SuspenseWrapper>
            <AboutPage />
          </SuspenseWrapper>
        ),
      },
      {
        path: 'release-notes',
        handle: readyWhen(ReleaseNotesPage),
        element: (
          <SuspenseWrapper>
            <ReleaseNotesPage />
          </SuspenseWrapper>
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
];

// Every route carries the label Speed Insights files its visits under (#688).
export const router = createBrowserRouter(withSpeedInsightsRoutes(routes));

// Art the prerendered page showed counts as shown only until the visitor leaves it (#915).
router.subscribe(forgetArtOnLeave);
