/** Shape of /data/vercel-analytics.json, produced by scripts/precompute-vercel-analytics.mjs. */

export interface TrendPoint {
  /** YYYY-MM-DD (one day inside the reporting window). */
  date: string;
  count: number;
}

export interface BreakdownRow {
  /** The eventData property value (e.g. 'quick', 'Amber'); 'Others' folds the tail beyond the query limit. */
  value: string;
  count: number;
  visitors: number;
}

export interface Breakdown {
  /** The eventData property this groups by (e.g. 'voteType'). */
  prop: string;
  label: string;
  rows: BreakdownRow[];
}

export interface VercelEvent {
  /** Custom event name from the AnalyticsEvents catalog (e.g. 'vote_submitted'). */
  name: string;
  label: string;
  /** Lifetime occurrences (events/count). */
  total: number;
  visitors: number;
  /** Daily occurrences within the reporting window. */
  trend: TrendPoint[];
  breakdowns: Breakdown[];
}

export interface ReportingWindow {
  since: string;
  until: string;
}

export interface VercelAnalytics {
  generatedAt: string;
  /** false for the empty-but-valid artifact written when the Vercel token/project env is absent. */
  hasVercelData: boolean;
  reportingWindow: ReportingWindow | null;
  events: VercelEvent[];
}
