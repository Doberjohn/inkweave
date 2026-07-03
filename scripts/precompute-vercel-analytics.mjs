#!/usr/bin/env node
/**
 * Build-time precompute: queries the Vercel Web Analytics Query API for the custom
 * events declared in EVENT_QUERIES and emits apps/web/public/data/vercel-analytics.json.
 *
 * Reads (all build-time only, NEVER VITE_-prefixed so they can't reach the client bundle):
 *   - VERCEL_ANALYTICS_TOKEN     — Vercel access token, read scope (required)
 *   - VERCEL_PROJECT_ID          — prj_… of the Inkweave project (required)
 *   - VERCEL_TEAM_ID             — team_… (optional; omit for a personal-account project)
 *   - VERCEL_ANALYTICS_WINDOW_DAYS — trend/breakdown lookback in days (optional, default 60, capped at 62)
 *
 * Degrades gracefully: when the token or project id is absent (forked PRs / offline
 * builds) it writes the empty-but-valid artifact and exits 0. A real API failure
 * (non-2xx) throws and exits 1.
 *
 * Docs: https://vercel.com/docs/analytics/web-analytics-api
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {
  EVENT_QUERIES,
  DEFAULT_BREAKDOWN_LIMIT,
  eventNameFilter,
  breakdownDimension,
  breakdownValueKey,
  reportingWindow,
  resolveWindowDays,
  buildEvent,
  buildVercelAnalytics,
  emptyVercelAnalytics,
} from './lib/vercelAnalytics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT_FILE = path.join(ROOT, 'apps/web/public/data/vercel-analytics.json');
const API_BASE = 'https://api.vercel.com/v1/query/web-analytics';

// --- env (mirror scripts/precompute-vote-analytics.mjs loader) ---
function loadEnv() {
  if (process.env.VERCEL_ANALYTICS_TOKEN && process.env.VERCEL_PROJECT_ID) return;
  try {
    const content = fs.readFileSync(path.join(ROOT, 'apps/web/.env.local'), 'utf8');
    for (const line of content.split('\n')) {
      const m = line.match(/^(VERCEL_ANALYTICS_TOKEN|VERCEL_PROJECT_ID|VERCEL_TEAM_ID|VERCEL_ANALYTICS_WINDOW_DAYS)=(.+)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  } catch {
    /* rely on env vars */
  }
}

function writeArtifact(obj) {
  fs.writeFileSync(OUT_FILE, JSON.stringify({...obj, generatedAt: new Date().toISOString()}));
}

/** One authenticated GET against the Web Analytics Query API; returns the `data` field. */
async function vercelQuery(endpoint, params, {token, projectId, teamId}) {
  const search = new URLSearchParams({projectId, ...params});
  if (teamId) search.set('teamId', teamId);
  const res = await fetch(`${API_BASE}/${endpoint}?${search}`, {
    headers: {Authorization: `Bearer ${token}`},
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Vercel API ${endpoint} ${res.status}: ${detail.slice(0, 300)}`);
  }
  const body = await res.json();
  return body.data;
}

/** Pull count + trend + every configured breakdown for one event. */
async function queryEvent(query, window, creds) {
  const filter = eventNameFilter(query.name);
  const count = await vercelQuery('events/count', {filter}, creds);
  const trend = await vercelQuery(
    'events/aggregate',
    {since: window.since, until: window.until, by: 'day', filter},
    creds,
  );
  const breakdowns = [];
  for (const b of query.breakdowns) {
    const rows = await vercelQuery(
      'events/aggregate',
      {
        since: window.since,
        until: window.until,
        by: breakdownDimension(b),
        filter,
        limit: String(b.limit ?? DEFAULT_BREAKDOWN_LIMIT),
      },
      creds,
    );
    breakdowns.push({prop: b.prop, label: b.label, valueKey: breakdownValueKey(b), numeric: b.numeric, rows});
  }
  return buildEvent({name: query.name, label: query.label, count, trend, breakdowns});
}

async function main() {
  console.log('⚙ Pre-computing Vercel Web Analytics...');
  loadEnv();
  const token = process.env.VERCEL_ANALYTICS_TOKEN;
  const projectId = process.env.VERCEL_PROJECT_ID;
  const teamId = process.env.VERCEL_TEAM_ID;

  if (!token || !projectId) {
    console.warn('  ⚠ VERCEL_ANALYTICS_TOKEN / VERCEL_PROJECT_ID absent — writing empty artifact.');
    writeArtifact(emptyVercelAnalytics());
    return;
  }

  const days = resolveWindowDays(process.env.VERCEL_ANALYTICS_WINDOW_DAYS);
  const window = reportingWindow(new Date(), days);
  const creds = {token, projectId, teamId};

  const events = [];
  for (const query of EVENT_QUERIES) {
    events.push(await queryEvent(query, window, creds));
  }

  const analytics = buildVercelAnalytics({events, window});
  writeArtifact(analytics);
  const totalEvents = events.reduce((sum, e) => sum + e.total, 0);
  console.log(`✓ ${events.length} events, ${totalEvents} total occurrences (window ${window.since}…${window.until})`);
  console.log(`  Output: ${OUT_FILE}`);
}

main().catch((err) => {
  // A non-critical admin analytics tab must never break a production deploy. Log loudly,
  // write the empty-but-valid artifact so the tab shows its no-data state, and exit 0.
  console.warn(`  ⚠ Vercel-analytics precompute failed — writing empty artifact, build continues: ${err.message}`);
  try {
    writeArtifact(emptyVercelAnalytics());
  } catch (writeErr) {
    console.warn(`  ⚠ Could not write empty artifact: ${writeErr.message}`);
  }
});
