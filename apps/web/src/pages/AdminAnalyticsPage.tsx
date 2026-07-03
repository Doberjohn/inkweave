import {useState} from 'react';
import {COLORS, FONTS, FONT_SIZES, RADIUS, SPACING} from '../shared/constants';
import {useVoteAnalytics} from '../features/admin-analytics/useVoteAnalytics';
import {useVoteLog} from '../features/admin-analytics/useVoteLog';
import {TabBar, type AdminTab} from '../features/admin-analytics/TabBar';
import {CalibrationView} from '../features/admin-analytics/CalibrationView';
import {ActivityView} from '../features/admin-analytics/ActivityView';
import type {VoteAnalytics} from '../features/admin-analytics/voteAnalyticsTypes';
import type {VoteLog} from '../features/admin-analytics/voteLogTypes';

/** Rendered while the vote-log artifact is still loading, so both tab views always receive a VoteLog. */
const EMPTY_VOTE_LOG: VoteLog = {generatedAt: '', votes: [], voterCount: 0};

interface DashboardProps {
  analytics: VoteAnalytics;
  voteLog: VoteLog;
}

/**
 * Presentational tabbed dashboard: the TabBar plus the active tab body. All
 * data arrives via props (fetched by the page), so Storybook can render it from
 * inline fixtures without hitting the network. Tab selection is local state.
 */
export function AdminAnalyticsDashboard({analytics, voteLog}: DashboardProps) {
  const [active, setActive] = useState<AdminTab>('calibration');

  return (
    <>
      <TabBar active={active} onChange={setActive} />
      {active === 'calibration' ? (
        <CalibrationView analytics={analytics} voteLog={voteLog} />
      ) : (
        <ActivityView voteLog={voteLog} />
      )}
    </>
  );
}

/**
 * Admin vote-calibration dashboard. Fetches the build-time analytics + vote-log
 * artifacts, then renders a tabbed dashboard (Calibration | Activity). The
 * vote-log may still be loading after analytics resolves; the views receive an
 * empty VoteLog fallback so they render regardless.
 */
export function AdminAnalyticsPage() {
  const {data: analytics, loading, error} = useVoteAnalytics();
  const {data: voteLog} = useVoteLog();

  return (
    <main
      style={{
        minHeight: '100vh',
        background: COLORS.background,
        color: COLORS.text,
        fontFamily: FONTS.body,
        padding: SPACING.lg,
        maxWidth: 1080,
        margin: '0 auto',
      }}>
      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: `1px solid ${COLORS.surfaceBorder}`,
          paddingBottom: SPACING.sm,
        }}>
        <div style={{fontSize: FONT_SIZES.base, fontWeight: 700, letterSpacing: '0.06em', color: COLORS.primary}}>
          INKWEAVE{' '}
          <span style={{color: COLORS.textMuted, fontWeight: 500, letterSpacing: 0}}>
            - Admin / Vote Calibration
          </span>
        </div>
        {analytics && (
          <span style={{fontSize: FONT_SIZES.xs, color: COLORS.textDim}}>
            data as of {analytics.generatedAt.slice(0, 10)}
          </span>
        )}
      </header>

      <h1
        style={{
          fontFamily: FONTS.hero,
          fontSize: FONT_SIZES.xxl,
          fontWeight: 700,
          margin: `${SPACING.section}px 0 ${SPACING.md}px`,
        }}>
        Engine Calibration
      </h1>

      {loading && <p style={{color: COLORS.textMuted}}>Loading analytics...</p>}
      {error && (
        <div
          style={{
            background: COLORS.errorBg,
            border: `1px solid ${COLORS.errorBorder}`,
            borderRadius: RADIUS.lg,
            padding: SPACING.md,
            color: COLORS.text,
          }}>
          Could not load vote analytics. Has the artifact been generated? ({error.message})
        </div>
      )}
      {analytics && <AdminAnalyticsDashboard analytics={analytics} voteLog={voteLog ?? EMPTY_VOTE_LOG} />}
    </main>
  );
}
