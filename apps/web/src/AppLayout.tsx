import {Suspense, useEffect, useRef, useState, type CSSProperties} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {SkeletonTheme} from 'react-loading-skeleton';
import {RevealsPromoCard, useRevealPhase, type RevealPhase} from './features/reveals';
import {
  BetaNotice,
  CtaButton,
  ErrorBoundary,
  MobileBottomNav,
  MOBILE_NAV_HEIGHT,
} from './shared/components';
import type {SearchBottomSheetHandle} from './shared/components/SearchBottomSheet';
import {CardDataProvider} from './shared/contexts/CardDataContext';
import {CardModalProvider} from './shared/contexts/CardModalContext';
import {COLORS} from './shared/constants';
import {useCardDataContext} from './shared/contexts/CardDataContext';
import {useResponsive} from './shared/hooks';
import {lazyWithRetry} from './shared/lib/lazyWithRetry';
import {useSpeedInsightsRoute} from './shared/lib/speedInsightsRoute';

// Mobile-only, so it stays out of the entry chunk desktop visitors download (#640). On a phone
// it loads right after the first render. A search tap in the moment before it arrives opens the
// sheet once the chunk lands, and focusSearchProxy keeps the iOS keyboard for that tap too.
const SearchBottomSheet = lazyWithRetry(
  () => import('./shared/components/SearchBottomSheet'),
  'SearchBottomSheet',
);

/** Invisible and unreachable, like the sheet's own proxy input. */
const SEARCH_PROXY_STYLE: CSSProperties = {position: 'fixed', opacity: 0, pointerEvents: 'none', left: -9999};

/**
 * Focus a proxy input synchronously in the tap's call stack, so iOS shows the keyboard. The
 * sheet's proxy exists only once its chunk has landed; a tap before that focuses the one
 * AppContent keeps outside the lazy boundary, and the sheet's input takes focus when it mounts.
 */
function focusSearchProxy(sheet: SearchBottomSheetHandle | null, earlyProxy: HTMLInputElement | null): void {
  if (sheet) sheet.focusProxy();
  else earlyProxy?.focus();
}

// Feature flag: gates the desktop-only beta notice card on the landing page.
// Off at v1.0.0 launch via Vercel env. Default on locally via .env.local.
const SHOW_BETA_NOTICE = import.meta.env.VITE_SHOW_BETA_NOTICE === 'true';

// Visibility helpers — sequential guards keep each conditional at 0 logical
// operators, and move their branches out of the parent component's lexical
// scope (lower CC, easier to unit-test in isolation).

interface RevealsPromoVisibility {
  isHome: boolean;
  phase: RevealPhase;
}

function shouldShowRevealsPromo({isHome, phase}: RevealsPromoVisibility): boolean {
  if (!isHome) return false;
  if (phase === 'pre-release') return true;
  if (phase === 'pre-release-live') return true;
  return false;
}

interface BetaNoticeVisibility {
  isHome: boolean;
  isMobile: boolean;
}

function shouldShowBetaNotice({isHome, isMobile}: BetaNoticeVisibility): boolean {
  if (!SHOW_BETA_NOTICE) return false;
  if (!isHome) return false;
  if (isMobile) return false;
  return true;
}

function AppContent() {
  const {error, retryLoad, requestLoad} = useCardDataContext();
  const {isMobile} = useResponsive();
  const {pathname} = useLocation();
  const isHome = pathname === '/';
  const showBottomNav = isMobile && !isHome;
  const phase = useRevealPhase();
  const showRevealsPromo = shouldShowRevealsPromo({isHome, phase});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<SearchBottomSheetHandle>(null);
  const earlyProxyRef = useRef<HTMLInputElement>(null);
  const searchButtonRef = useRef<HTMLButtonElement>(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  // The card list may wait on the homepage (#641); every other page needs it at once.
  useEffect(() => {
    if (!isHome) requestLoad();
  }, [isHome, requestLoad]);

  const openSearch = () => {
    focusSearchProxy(searchRef.current, earlyProxyRef.current);
    setIsSearchOpen(true);
  };
  const closeSearch = () => setIsSearchOpen(false);

  if (error) {
    return (
      <div role="alert" style={{padding: '40px', textAlign: 'center'}}>
        <h2 style={{color: COLORS.error}}>Error loading cards</h2>
        <p style={{color: COLORS.gray600, marginBottom: '20px'}}>{error.message}</p>
        <CtaButton onClick={retryLoad} style={{margin: '0 auto'}}>
          Try Again
        </CtaButton>
      </div>
    );
  }

  return (
    <>
      <div style={showBottomNav ? {paddingBottom: MOBILE_NAV_HEIGHT} : undefined}>
        <Outlet />
      </div>
      {showBottomNav && (
        <MobileBottomNav onSearchClick={openSearch} searchButtonRef={searchButtonRef} />
      )}
      {isMobile && (
        <>
          <input ref={earlyProxyRef} aria-hidden="true" tabIndex={-1} style={SEARCH_PROXY_STYLE} />
          <Suspense fallback={null}>
            <SearchBottomSheet
              ref={searchRef}
              isOpen={isSearchOpen}
              onClose={closeSearch}
              returnFocusRef={searchButtonRef}
            />
          </Suspense>
        </>
      )}
      {showRevealsPromo && (
        <RevealsPromoCard />
      )}
      {shouldShowBetaNotice({isHome, isMobile}) && <BetaNotice />}
    </>
  );
}

export function AppLayout() {
  // Only the page the app starts on decides; the provider reads this once, at mount.
  const startsOnHome = useLocation().pathname === '/';
  const speedInsightsRoute = useSpeedInsightsRoute();
  return (
    <ErrorBoundary>
      {/* One SkeletonTheme for the whole app (#511) — the 11 per-feature wrappers collapse into this. */}
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <CardDataProvider deferInitialLoad={startsOnHome}>
          <CardModalProvider>
            <AppContent />
          </CardModalProvider>
        </CardDataProvider>
      </SkeletonTheme>
      <Analytics />
      <SpeedInsights route={speedInsightsRoute} />
    </ErrorBoundary>
  );
}
