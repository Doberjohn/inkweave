/**
 * Pure transforms for the Vercel Web Analytics precompute. No network or filesystem
 * here, so this module is unit-tested by `pnpm test:scripts`. The orchestrator
 * (scripts/precompute-vercel-analytics.mjs) does the fetching and file write, then
 * calls into these helpers to shape the raw API JSON into the artifact the web app
 * reads from /data/vercel-analytics.json.
 *
 * The Vercel Web Analytics Query API speaks OData: you narrow a dataset with a
 * `filter` expression and group it with a `by` dimension. See
 * https://vercel.com/docs/analytics/web-analytics-api
 */

/**
 * Which custom events to pull and how to break each one down. A breakdown is:
 *   {prop, label, source?: 'eventData' | 'dimension', numeric?: boolean, limit?: number}
 *
 * - source 'eventData' (default): a property sent with track() — grouped by
 *   `eventData/<prop>`, value returned under the row's `eventData` field.
 * - source 'dimension': a Vercel automatic dimension (deviceType, country, …) —
 *   grouped by a bare `by=<prop>`, value returned under the row's `<prop>` field.
 * - numeric: sort rows by their numeric value ascending, so score breakdowns read
 *   as a distribution rather than a top-N-by-count list.
 *
 * Every eventData `prop` is declared in the AnalyticsEvents catalog
 * (apps/web/src/shared/lib/analytics.ts). Edit this table to add or drop dimensions.
 */
export const EVENT_QUERIES = [
  {
    name: 'reveal_card_click',
    label: 'Reveal card clicks',
    breakdowns: [
      {prop: 'source', label: 'By source'},
      {prop: 'franchise', label: 'By franchise', limit: 12},
      {prop: 'ink', label: 'By ink'},
      {prop: 'type', label: 'By card type'},
      {prop: 'rarity', label: 'By rarity'},
      {prop: 'deviceType', label: 'By device', source: 'dimension'},
    ],
  },
  {
    name: 'vote_submitted',
    label: 'Votes submitted',
    breakdowns: [
      {prop: 'voteType', label: 'By vote type'},
      {prop: 'engineScore', label: 'By engine score', numeric: true, limit: 12},
      {prop: 'userScore', label: 'By user score', numeric: true, limit: 12},
      {prop: 'deviceType', label: 'By device', source: 'dimension'},
    ],
  },
  {
    name: 'card_selected',
    label: 'Card details opened',
    breakdowns: [
      {prop: 'source', label: 'By source'},
      {prop: 'ink', label: 'By ink'},
      {prop: 'type', label: 'By card type'},
    ],
  },
  {
    name: 'synergy_card_clicked',
    label: 'Synergy cards followed',
    breakdowns: [
      {prop: 'clickedCardInk', label: 'By ink'},
      {prop: 'clickedCardName', label: 'Top cards', limit: 10},
      {prop: 'groupKey', label: 'By synergy group', limit: 10},
    ],
  },
  {
    name: 'playstyle_opened',
    label: 'Playstyles opened',
    breakdowns: [{prop: 'playstyleId', label: 'By playstyle', limit: 15}],
  },
  {
    name: 'vote_skipped',
    label: 'Votes skipped',
    breakdowns: [{prop: 'engineScore', label: 'By engine score', numeric: true, limit: 12}],
  },
  {
    name: 'search_submitted',
    label: 'Searches',
    breakdowns: [
      {prop: 'source', label: 'By source'},
      {prop: 'query', label: 'Top queries', limit: 10},
      {prop: 'deviceType', label: 'By device', source: 'dimension'},
    ],
  },
  {
    name: 'filter_applied',
    label: 'Filters applied',
    breakdowns: [
      {prop: 'facet', label: 'By facet'},
      {prop: 'value', label: 'By value', limit: 20},
      {prop: 'action', label: 'By action'},
    ],
  },
  {
    name: 'sort_changed',
    label: 'Sort changes',
    breakdowns: [{prop: 'sortOrder', label: 'By sort order'}],
  },
  {
    name: 'synergy_group_viewed',
    label: 'Synergy groups viewed',
    breakdowns: [
      {prop: 'action', label: 'By action'},
      {prop: 'groupKey', label: 'By synergy group', limit: 10},
    ],
  },
];

/** Fallback top-N when a breakdown does not set its own `limit`. */
export const DEFAULT_BREAKDOWN_LIMIT = 20;

/** OData filter selecting one custom event by name (single quotes doubled per OData). */
export function eventNameFilter(eventName) {
  return `eventName eq '${eventName.replace(/'/g, "''")}'`;
}

/**
 * OData `by` dimension for grouping a custom event by one of its eventData properties.
 * An identifier-safe name (letters, digits, underscore) is referenced bare
 * (`eventData/voteType`); any other character forces single-quoting, with internal
 * quotes doubled per OData (`eventData/'signup-source'`). See the Web Analytics API docs.
 */
export function eventDataDimension(prop) {
  if (/^[A-Za-z0-9_]+$/.test(prop)) return `eventData/${prop}`;
  return `eventData/'${prop.replace(/'/g, "''")}'`;
}

/** The `by` value for a breakdown: a bare automatic dimension, or an eventData key. */
export function breakdownDimension(breakdown) {
  return breakdown.source === 'dimension' ? breakdown.prop : eventDataDimension(breakdown.prop);
}

/** The row field the grouped value lands in: the dimension name, or `eventData`. */
export function breakdownValueKey(breakdown) {
  return breakdown.source === 'dimension' ? breakdown.prop : 'eventData';
}

/** Default trend/breakdown lookback in days. */
export const DEFAULT_WINDOW_DAYS = 60;

/**
 * Vercel caps day-granularity (`by=day`) aggregate queries at 62 days of data, so the
 * trend query can't look back further. Clamp the whole window to stay within the cap.
 */
export const MAX_WINDOW_DAYS = 62;

/** Resolve the configured window (an env string) to a valid day count within the API cap. */
export function resolveWindowDays(envValue) {
  const n = Number(envValue);
  const days = Number.isFinite(n) && n > 0 ? n : DEFAULT_WINDOW_DAYS;
  return Math.min(days, MAX_WINDOW_DAYS);
}

/**
 * Reporting window [since, until] as YYYY-MM-DD strings, `days` back from `reference`
 * (a Date). Aggregate queries only see data inside the plan's reporting window, so the
 * orchestrator bounds every trend/breakdown request with this.
 */
export function reportingWindow(reference, days) {
  const until = reference.toISOString().slice(0, 10);
  const since = new Date(reference.getTime() - days * 86_400_000).toISOString().slice(0, 10);
  return {since, until};
}

/** Numeric-ascending comparator that pushes non-numeric values (e.g. an "Others" row) last. */
function byNumericValue(a, b) {
  const na = Number(a.value);
  const nb = Number(b.value);
  if (Number.isNaN(na)) return 1;
  if (Number.isNaN(nb)) return -1;
  return na - nb;
}

/**
 * Fold the raw API results for one event into the artifact's event shape.
 * `count` is the events/count response body's `data`; `trend` the by=day aggregate
 * rows; `breakdowns` an array of {prop, label, valueKey?, numeric?, rows} where each
 * raw row carries `count`, `visitors`, and the grouped value under `valueKey`.
 */
export function buildEvent({name, label, count, trend, breakdowns}) {
  return {
    name,
    label,
    total: count?.count ?? 0,
    visitors: count?.visitors ?? 0,
    trend: (trend ?? []).map((row) => ({
      date: (row.timestamp ?? row.date ?? '').slice(0, 10),
      count: row.count ?? 0,
    })),
    breakdowns: (breakdowns ?? []).map((b) => {
      const rows = (b.rows ?? []).map((row) => ({
        value: String(row[b.valueKey] ?? row.eventData ?? row.value ?? ''),
        count: row.count ?? 0,
        visitors: row.visitors ?? 0,
      }));
      if (b.numeric) rows.sort(byNumericValue);
      return {prop: b.prop, label: b.label, rows};
    }),
  };
}

/** Assemble the full artifact object (generatedAt is stamped by the orchestrator). */
export function buildVercelAnalytics({events, window}) {
  return {
    hasVercelData: events.length > 0,
    reportingWindow: window ?? null,
    events,
  };
}

/** The empty-but-valid artifact written when the Vercel token/project env is absent. */
export function emptyVercelAnalytics() {
  return {hasVercelData: false, reportingWindow: null, events: []};
}
