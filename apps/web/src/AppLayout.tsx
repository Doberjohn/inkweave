import {Outlet} from 'react-router-dom';
import {Analytics} from '@vercel/analytics/react';
import {SpeedInsights} from '@vercel/speed-insights/react';
import {CardPreviewProvider, CardPreviewPopover} from './features/cards';
import {ErrorBoundary} from './shared/components';
import {CardDataProvider} from './shared/contexts/CardDataContext';
import {COLORS} from './shared/constants';
import {useCardDataContext} from './shared/contexts/CardDataContext';

function AppContent() {
  const {error, retryLoad} = useCardDataContext();

  if (error) {
    return (
      <div style={{padding: '40px', textAlign: 'center'}}>
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

  return <Outlet />;
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
