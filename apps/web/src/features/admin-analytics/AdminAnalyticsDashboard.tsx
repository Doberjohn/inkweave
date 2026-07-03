import {useState} from 'react';
import {TabBar, type AdminTab} from './TabBar';
import {CalibrationView} from './CalibrationView';
import {ActivityView} from './ActivityView';
import {WebAnalyticsView} from './WebAnalyticsView';
import type {VoteAnalytics} from './voteAnalyticsTypes';
import type {VoteLog} from './voteLogTypes';
import type {VercelAnalytics} from './vercelAnalyticsTypes';

interface DashboardProps {
  analytics: VoteAnalytics;
  voteLog: VoteLog;
  vercelAnalytics: VercelAnalytics | null;
}

/**
 * Presentational tabbed dashboard: the TabBar plus the active tab body. All
 * data arrives via props (fetched by the page), so Storybook can render it from
 * inline fixtures without hitting the network. Tab selection is local state.
 *
 * Lives in the feature folder (not the route module) so the route module can
 * export only the zero-prop page component, satisfying router.tsx's
 * lazyWithRetry module-type constraint.
 */
export function AdminAnalyticsDashboard({analytics, voteLog, vercelAnalytics}: DashboardProps) {
  const [active, setActive] = useState<AdminTab>('calibration');

  return (
    <>
      <TabBar active={active} onChange={setActive} />
      {active === 'calibration' ? (
        <CalibrationView analytics={analytics} voteLog={voteLog} />
      ) : active === 'activity' ? (
        <ActivityView voteLog={voteLog} />
      ) : (
        <WebAnalyticsView analytics={vercelAnalytics} />
      )}
    </>
  );
}
