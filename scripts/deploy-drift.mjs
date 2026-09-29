/**
 * Deploy-drift alarm (#569): is production serving master?
 *
 * Production answers GET /version.json with the commit it was built from
 * (scripts/write-version.mjs). This script compares that commit with master and keeps ONE
 * open GitHub issue, labelled `deploy-drift` and assigned to the repo owner, in step with
 * the answer:
 *   - production serves master: close the open drift issue, if there is one;
 *   - production has been behind for longer than the grace period, or its stamp cannot be
 *     read: open the issue, or refresh the one already open;
 *   - behind, but within the grace period: do nothing (a normal deploy takes 10-30 min).
 * A failed Deploy run (DEPLOY_FAILED_RUN_URL, set by the workflow_run trigger) is reported
 * at once, without waiting out the grace period, unless production already serves master.
 *
 * The age of the drift runs from when master first moved past the deployed commit: the
 * oldest commit on master's first-parent chain that production lacks. Timing it from
 * master's newest commit instead would restart the clock on every merge, so a broken
 * pipeline would stay quiet for as long as merges kept landing. That is how the 2026-07-28
 * build stayed live until 2026-09-23. Commits marked [skip ci] never start a Deploy run
 * (the reveal-image bot pushes one after every upload), so the walk passes them uncounted.
 *
 * A manual run with DEPLOYED_SHA simulates production's commit. It works on a separate
 * `deploy-drift-test` issue, so a test can never rewrite or close a real alarm.
 *
 * Env: GH_TOKEN (issues: write), GITHUB_REPOSITORY (owner/repo), PROD_URL (default
 * https://inkweave.ink), THRESHOLD_HOURS (default 3), DRY_RUN=1 (print the verdict, touch
 * no issue), DEPLOYED_SHA, DEPLOY_FAILED_RUN_URL. Run by .github/workflows/deploy-drift.yml.
 */
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const FULL_SHA = /^[0-9a-f]{40}$/;
// GitHub's commit-message markers for "start no workflow run for this push".
const SKIPS_DEPLOY = /\[(?:skip ci|ci skip|no ci|skip actions|actions skip)\]/i;
const HOUR_MS = 3_600_000;
const FETCH_TIMEOUT_MS = 15_000;
// Master's history is fetched 100 commits a page. A deployed commit not reached within
// these pages counts as "not found", and the drift is then at least as old as the oldest
// commit walked.
const MAX_PAGES = 3;

/** The real alarm, and the separate issue that simulated (DEPLOYED_SHA) runs work on. */
const MODES = {
  real: {
    label: 'deploy-drift',
    color: 'b60205',
    labelDescription: 'Production is not serving master (#569)',
    title: 'Production is not serving master (deploy drift)',
    assignOwner: true,
  },
  simulated: {
    label: 'deploy-drift-test',
    color: 'c5def5',
    labelDescription: 'Simulated deploy-drift alarm from a manual test run (#569)',
    title: '[Simulated] Production is not serving master (deploy drift)',
    assignOwner: false,
  },
};

/**
 * Walk master's first-parent chain from `masterSha` back to `deployedSha`. `commits` maps a
 * sha to {parents, date, skipsDeploy} for recent commits on master. Returns {behind, since,
 * found}: how many first-parent commits production lacks, when the oldest of them landed,
 * and whether the walk reached the deployed commit. Side-branch commits never count, so a
 * merged PR whose branch commits are days old does not make the drift look older than the
 * merge. Neither do [skip ci] commits: they never deploy, so production cannot serve them.
 * Exported for scripts/deploy-drift.test.mjs.
 */
export function measureDrift(commits, masterSha, deployedSha) {
  let behind = 0;
  let since = null;
  let sha = masterSha;
  while (sha !== deployedSha) {
    const commit = commits.get(sha);
    if (!commit) return {behind, since, found: false};
    if (!commit.skipsDeploy) {
      behind++;
      since = commit.date;
    }
    sha = commit.parents[0];
  }
  return {behind, since, found: true};
}

/** Hours since the oldest commit production lacks landed on master. */
const driftAgeHours = (drift, now) => (now - Date.parse(drift.since)) / HOUR_MS;

const inSync = (drift) => Boolean(drift?.found && drift.behind === 0);

/**
 * Reasons to alert without waiting out the grace period: a failed deploy, an unreadable
 * production stamp, or a deployed commit missing from master's recent first-parent chain.
 */
const alertsAtOnce = ({drift, stampError, deployFailed}) =>
  Boolean(deployFailed || stampError || !drift?.found);

/**
 * 'alert', 'in-sync' or 'within-grace'. Production serving master outranks a failed run:
 * GitHub already mails that failure, and an issue saying "not serving master" would be wrong.
 * Plain drift alerts once it is older than the grace period.
 */
export function decide({drift, stampError, deployFailed, now, thresholdHours}) {
  if (inSync(drift)) return 'in-sync';
  if (alertsAtOnce({drift, stampError, deployFailed})) return 'alert';
  return driftAgeHours(drift, now) > thresholdHours ? 'alert' : 'within-grace';
}

/**
 * Production's commit from version.json's text as {sha}, or {error}. Exported for
 * scripts/deploy-drift.test.mjs.
 */
export function parseStamp(text) {
  let sha;
  try {
    sha = JSON.parse(text)?.sha;
  } catch {
    // Defensive: the SPA rewrite skips paths with a dot, so a missing file is a real 404
    // today, but an HTML answer must never read as a stamp.
    return {error: 'GET /version.json did not answer JSON'};
  }
  return FULL_SHA.test(sha ?? '')
    ? {sha}
    : {error: `version.json has no full commit sha ("${sha}")`};
}

const short = (sha) => `\`${sha.slice(0, 8)}\``;
const utc = (ms) => `${new Date(ms).toISOString().slice(0, 16).replace('T', ' ')} UTC`;

/** The issue's "Behind by" line, or null when production's commit is unknown. */
function behindLine(drift, now, thresholdHours) {
  if (!drift) return null;
  if (!drift.found) {
    const older = drift.since ? `, so the drift is older than ${utc(Date.parse(drift.since))}` : '';
    return `- **Behind by:** more than ${drift.behind} commit(s): production's commit is not on master's recent first-parent chain${older}.`;
  }
  const age = driftAgeHours(drift, now).toFixed(1);
  return `- **Behind by:** ${drift.behind} commit(s) on master's first-parent chain. The oldest landed ${utc(Date.parse(drift.since))}, ${age} h ago (grace period: ${thresholdHours} h).`;
}

/** The tracking issue's body: what production serves, how far behind it is, and why. */
export function issueBody({
  repo,
  prodUrl,
  stamp,
  masterSha,
  drift,
  now,
  thresholdHours,
  runUrl,
  failedRunUrl,
  simulated,
}) {
  const lines = ['**Production is not serving master.**', ''];
  lines.push(
    stamp.sha
      ? `- **Production:** ${short(stamp.sha)}, from ${prodUrl}/version.json`
      : `- **Production:** its version stamp could not be read: ${stamp.error}`,
  );
  lines.push(`- **Master:** ${short(masterSha)}`);
  const behind = behindLine(drift, now, thresholdHours);
  if (behind) lines.push(behind);
  if (failedRunUrl) lines.push(`- **Failed deploy:** ${failedRunUrl}`);
  lines.push(`- **Checked:** ${utc(now)} by ${runUrl}`);
  if (simulated) {
    lines.push(
      '',
      "_Simulated: this run was handed production's commit by hand (`deployed_sha`)._",
    );
  }
  lines.push(
    '',
    `Start with the latest [Deploy runs](https://github.com/${repo}/actions/workflows/deploy.yml).`,
    '',
    'This issue closes itself at the next check that finds production serving master. The check lives in `.github/workflows/deploy-drift.yml` (#569).',
  );
  return lines.join('\n');
}

async function github(path, {method = 'GET', body, allow = []} = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      authorization: `Bearer ${process.env.GH_TOKEN}`,
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(body && {'content-type': 'application/json'}),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(2 * FETCH_TIMEOUT_MS),
  });
  if (allow.includes(res.status)) return null;
  if (!res.ok) throw new Error(`${method} ${path}: HTTP ${res.status} ${await res.text()}`);
  return res.status === 204 ? null : res.json();
}

/** GET with a timeout, retried on network errors and 5xx answers: 3 tries, 2 s then 4 s apart. */
async function fetchWithRetry(url, tries = 3) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {signal: AbortSignal.timeout(FETCH_TIMEOUT_MS)});
      if (res.status < 500 || attempt === tries) return res;
    } catch (e) {
      if (attempt === tries) throw e;
    }
    await new Promise((done) => setTimeout(done, 2000 * attempt));
  }
}

/**
 * Production's commit as {sha}, or {error} when /version.json cannot be read. No cache
 * buster is needed: Vercel serves each deployment's static files from that deployment, so a
 * new deploy answers with its own stamp at once (and the edge ignores query strings anyway).
 */
async function readProductionStamp(prodUrl) {
  let res;
  try {
    res = await fetchWithRetry(`${prodUrl}/version.json`);
  } catch (e) {
    return {error: `GET /version.json failed: ${e.message}`};
  }
  if (!res.ok) return {error: `GET /version.json answered HTTP ${res.status}`};
  return parseStamp(await res.text());
}

/** True once the deployed commit is loaded, or when there is none to look for. */
const hasDeployed = (commits, deployedSha) => !deployedSha || commits.has(deployedSha);

/**
 * Master's tip, plus a map of its recent commits (sha to {parents, date, skipsDeploy}),
 * fetched 100 at a time until the deployed commit is among them or MAX_PAGES run out.
 */
async function loadMasterHistory(repo, deployedSha) {
  const commits = new Map();
  let masterSha;
  for (let page = 1; page <= MAX_PAGES; page++) {
    const list = await github(`/repos/${repo}/commits?sha=master&per_page=100&page=${page}`);
    for (const c of list) {
      masterSha ??= c.sha;
      commits.set(c.sha, {
        parents: c.parents.map((p) => p.sha),
        date: c.commit.committer.date,
        skipsDeploy: SKIPS_DEPLOY.test(c.commit.message),
      });
    }
    const lastPage = list.length < 100;
    if (lastPage || hasDeployed(commits, deployedSha)) break;
  }
  return {masterSha, commits};
}

async function findOpenIssue(repo, mode) {
  const issues = await github(`/repos/${repo}/issues?labels=${mode.label}&state=open&per_page=10`);
  return issues.find((issue) => !issue.pull_request) ?? null;
}

async function refreshIssue(repo, open, body, failedRunUrl) {
  await github(`/repos/${repo}/issues/${open.number}`, {method: 'PATCH', body: {body}});
  // A body edit notifies nobody; a new failure is worth a notification.
  if (failedRunUrl) {
    await github(`/repos/${repo}/issues/${open.number}/comments`, {
      method: 'POST',
      body: {body: `Another Deploy run failed: ${failedRunUrl}`},
    });
  }
  console.log(`[drift] refreshed #${open.number}`);
}

async function openIssue(repo, mode, body) {
  await github(`/repos/${repo}/labels`, {
    method: 'POST',
    body: {name: mode.label, color: mode.color, description: mode.labelDescription},
    allow: [422], // the label already exists
  });
  // Assigning notifies the owner whatever their watch setting is.
  const assignees = mode.assignOwner ? [repo.split('/')[0]] : [];
  const created = await github(`/repos/${repo}/issues`, {
    method: 'POST',
    body: {title: mode.title, body, labels: [mode.label], assignees},
  });
  console.log(`[drift] opened #${created.number}`);
}

async function closeIssue(repo, open, {stamp, masterSha, runUrl}) {
  await github(`/repos/${repo}/issues/${open.number}/comments`, {
    method: 'POST',
    body: {
      body: `Production serves master again: it runs ${short(stamp.sha)}, master is at ${short(masterSha)}. Checked by ${runUrl}.`,
    },
  });
  await github(`/repos/${repo}/issues/${open.number}`, {
    method: 'PATCH',
    body: {state: 'closed', state_reason: 'completed'},
  });
  console.log(`[drift] closed #${open.number}`);
}

function requireRepo(env) {
  if (!env.GITHUB_REPOSITORY) throw new Error('GITHUB_REPOSITORY is not set');
  return env.GITHUB_REPOSITORY;
}

/** THRESHOLD_HOURS as hours (default 3). Anything that is not a number >= 0 is an error. */
function parseThreshold(value) {
  const hours = Number(value || 3);
  if (!(hours >= 0)) throw new Error(`THRESHOLD_HOURS must be a number >= 0, got "${value}"`);
  return hours;
}

/** DEPLOYED_SHA, the manual stand-in for production's commit: empty, or a full sha. */
function parseOverride(value) {
  const sha = value?.trim() || '';
  if (sha && !FULL_SHA.test(sha)) {
    throw new Error(`DEPLOYED_SHA must be a full commit sha, got "${sha}"`);
  }
  return sha;
}

const runLink = (env, repo) =>
  env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`
    : 'a local run';

function readConfig(env) {
  const repo = requireRepo(env);
  return {
    repo,
    thresholdHours: parseThreshold(env.THRESHOLD_HOURS),
    override: parseOverride(env.DEPLOYED_SHA),
    prodUrl: env.PROD_URL || 'https://inkweave.ink',
    dryRun: env.DRY_RUN === '1',
    failedRunUrl: env.DEPLOY_FAILED_RUN_URL || '',
    runUrl: runLink(env, repo),
  };
}

/** One log line: what production serves, master's tip, and the verdict. */
function verdictLine(stamp, masterSha, verdict, drift) {
  const production = stamp.sha ?? `unreadable (${stamp.error})`;
  const detail = drift
    ? ` (behind ${drift.behind}${drift.found ? '' : '+'}, since ${drift.since ?? '-'})`
    : '';
  return `[drift] production ${production}, master ${masterSha}: ${verdict}${detail}`;
}

/** Open, refresh or close the tracking issue to match the verdict. */
async function applyVerdict(verdict, context) {
  if (verdict === 'within-grace') return;
  const {repo, override, failedRunUrl} = context;
  const mode = override ? MODES.simulated : MODES.real;
  const open = await findOpenIssue(repo, mode);
  if (verdict === 'in-sync') {
    if (open) await closeIssue(repo, open, context);
    return;
  }
  const body = issueBody({...context, simulated: Boolean(override)});
  if (open) await refreshIssue(repo, open, body, failedRunUrl);
  else await openIssue(repo, mode, body);
}

async function main() {
  const config = readConfig(process.env);
  const stamp = config.override
    ? {sha: config.override}
    : await readProductionStamp(config.prodUrl);
  const {masterSha, commits} = await loadMasterHistory(config.repo, stamp.sha);
  const drift = stamp.sha ? measureDrift(commits, masterSha, stamp.sha) : null;
  const now = Date.now();
  const verdict = decide({
    drift,
    stampError: stamp.error,
    deployFailed: Boolean(config.failedRunUrl),
    now,
    thresholdHours: config.thresholdHours,
  });
  console.log(verdictLine(stamp, masterSha, verdict, drift));
  if (config.dryRun) {
    console.log('[drift] dry run: no issue touched');
    return;
  }
  await applyVerdict(verdict, {...config, stamp, masterSha, drift, now});
}

// Run only when invoked directly (never when imported by the test).
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
