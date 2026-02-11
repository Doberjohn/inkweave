import {lazy, Suspense} from 'react';
import {createBrowserRouter} from 'react-router-dom';
import {AppLayout} from './AppLayout';
import {LoadingSpinner} from './shared/components';

// Lazy-load page components for code splitting
const HomePage = lazy(() => import('./pages/HomePage').then((m) => ({default: m.HomePage})));
const BrowsePage = lazy(() => import('./pages/BrowsePage').then((m) => ({default: m.BrowsePage})));
const CardPage = lazy(() => import('./pages/CardPage').then((m) => ({default: m.CardPage})));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage').then((m) => ({default: m.NotFoundPage})));

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
      {path: '*', element: <SuspenseWrapper><NotFoundPage /></SuspenseWrapper>},
    ],
  },
]);
