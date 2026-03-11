import {useCallback, useEffect, useRef, useState} from 'react';
import {Outlet, useLocation} from 'react-router-dom';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {CardPreviewProvider, CardPreviewPopover} from './features/cards';
import {
  ErrorBoundary,
  MobileBottomNav,
  MOBILE_NAV_HEIGHT,
  SearchBottomSheet,
} from './shared/components';
import type {SearchBottomSheetHandle} from './shared/components/SearchBottomSheet';
import {CardDataProvider} from './shared/contexts/CardDataContext';
import {COLORS} from './shared/constants';
import {useCardDataContext} from './shared/contexts/CardDataContext';
import {useResponsive} from './shared/hooks';

function AppContent() {
  const {error, retryLoad} = useCardDataContext();
  const {isMobile} = useResponsive();
  const {pathname} = useLocation();
  const isHome = pathname === '/';
  const showBottomNav = isMobile && !isHome;
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const searchRef = useRef<SearchBottomSheetHandle>(null);

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  const openSearch = useCallback(() => {
    // Focus the proxy input synchronously in the tap call stack so iOS shows the keyboard
    searchRef.current?.focusProxy();
    setIsSearchOpen(true);
  }, []);
  const closeSearch = useCallback(() => setIsSearchOpen(false), []);

  if (error) {
    return (
      <div role="alert" style={{padding: '40px', textAlign: 'center'}}>
        <h2 style={{color: COLORS.error}}>Error loading cards</h2>
        <p style={{color: COLORS.gray600, marginBottom: '20px'}}>{error.message}</p>
        <button
          onClick={retryLoad}
          style={{
            padding: '10px 20px',
            background: COLORS.primary500,
            color: COLORS.white,
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '16px',
            fontWeight: 500,
          }}>
          Try Again
        </button>
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
    </>
  );
}

export function AppLayout() {
  return (
    <ErrorBoundary>
      <CardPreviewProvider>
        <CardDataProvider>
          <AppContent />
          <CardPreviewPopover />
        </CardDataProvider>
      </CardPreviewProvider>
      <Analytics />
      <SpeedInsights />
    </ErrorBoundary>
  );
}
