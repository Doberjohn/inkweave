import {useEffect, useRef, useState} from 'react';
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
  SearchBottomSheet,
} from './shared/components';
import type {SearchBottomSheetHandle} from './shared/components/SearchBottomSheet';
import {CardDataProvider} from './shared/contexts/CardDataContext';
import {CardModalProvider} from './shared/contexts/CardModalContext';
import {COLORS} from './shared/constants';
import {useCardDataContext} from './shared/contexts/CardDataContext';
import {useResponsive} from './shared/hooks';

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
  const {error, retryLoad} = useCardDataContext();
  const {isMobile} = useResponsive();
  const {pathname} = useLocation();
  const isHome = pathname === '/';
  const showBottomNav = isMobile && !isHome;
  const phase = useRevealPhase();
  const showRevealsPromo = shouldShowRevealsPromo({isHome, phase});
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<SearchBottomSheetHandle>(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const openSearch = () => {
    // Focus the proxy input synchronously in the tap call stack so iOS shows the keyboard
    searchRef.current?.focusProxy();
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
      {showBottomNav && <MobileBottomNav onSearchClick={openSearch} />}
      {isMobile && (
        <SearchBottomSheet ref={searchRef} isOpen={isSearchOpen} onClose={closeSearch} />
      )}
      {showRevealsPromo && (
        <RevealsPromoCard />
      )}
      {shouldShowBetaNotice({isHome, isMobile}) && <BetaNotice />}
    </>
  );
}

export function AppLayout() {
  return (
    <ErrorBoundary>
      {/* One SkeletonTheme for the whole app (#511) — the 11 per-feature wrappers collapse into this. */}
      <SkeletonTheme baseColor={COLORS.surfaceAlt} highlightColor={COLORS.surfaceHover}>
        <CardDataProvider>
          <CardModalProvider>
            <AppContent />
          </CardModalProvider>
        </CardDataProvider>
      </SkeletonTheme>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
