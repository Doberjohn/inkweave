import {useState} from 'react';
import {TabList} from '../../shared/components/TabList';
import {SPACING} from '../../shared/constants';
import {CalibrationView} from './CalibrationView';
import {ActivityView} from './ActivityView';
import {WebAnalyticsView} from './WebAnalyticsView';
import type {VoteAnalytics} from './voteAnalyticsTypes';
import type {VoteLog} from './voteLogTypes';
import type {VercelAnalytics} from './vercelAnalyticsTypes';

type AdminTab = 'calibration' | 'activity' | 'webAnalytics';

const TABS: ReadonlyArray<{id: AdminTab; label: string}> = [
  {id: 'calibration', label: 'Calibration'},
  {id: 'activity', label: 'Activity'},
  {id: 'webAnalytics', label: 'Web Analytics'},
];

interface DashboardProps {
  analytics: VoteAnalytics;
  voteLog: VoteLog;
  vercelAnalytics: VercelAnalytics | null;
}

/**
 * Presentational tabbed dashboard: the shared TabList plus the active tab
 * body (#509 folded the local TabBar into it). All data arrives via props
 * (fetched by the page), so Storybook can render it from inline fixtures
 * without hitting the network. Tab selection is local state.
 *
 * Lives in the feature folder (not the route module) so the route module can
 * export only the zero-prop page component, satisfying router.tsx's
 * lazyWithRetry module-type constraint.
 */
export function AdminAnalyticsDashboard({analytics, voteLog, vercelAnalytics}: DashboardProps) {
  const [active, setActive] = useState<AdminTab>('calibration');

  return (
    <>
      <div style={{marginBottom: SPACING.section}}>
        <TabList tabs={TABS} active={active} onChange={setActive} ariaLabel="Admin analytics views" />
      </div>
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
