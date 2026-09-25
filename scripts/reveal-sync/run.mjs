#!/usr/bin/env node
/**
 * /fetch-reveals command line. Each subcommand is one step of a run; the skill
 * (.claude/skills/fetch-reveals/SKILL.md) runs them in order and does the browser and vision
 * work in between.
 *
 *   start [--allow-non-master-base]    check the branch, read the official list, open a run
 *   snippet                            print the in-page code to install in the site's tab
 *   candidates <run> [--only a,b]      read the discovered index, list the cards to fetch;
 *                                      --only fetches the named cards whatever their state
 *   ingest <run>                       read the fetched pages, apply the gates, fetch the
 *                                      official scans, list reader jobs
 *   adjudicate <run>                   read the readers' results, decide, list any escalations
 *   resolve <run> <slug> <field>=<v>   record the owner's ruling on a field the readers
 *                                      disputed, or one the two sites disagree on
 *   write <run>                        write verified cards, stage their art, update state
 *   report <run>                       print the report
 *
 * It never commits or pushes. `write` leaves changes in the working tree for the owner.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {RulingError, adjudicate} from './adjudicate.mjs';
import {BROWSER_API_VERSION, installSnippet} from './browser.mjs';
import {UsageError, entries, git, say} from './cli.mjs';
import {SiteRecordError, parseCardLines} from './extract-card.mjs';
import {RARITIES, existingVerdict, gateCard} from './gates.mjs';
import {
  OFFICIAL_IMAGE,
  OfficialListError,
  applyOfficialRulings,
  downloadOfficialImage,
  fetchOfficialList,
  leakAudit,
  officialFullName,
  officialIdentity,
  officialSummary,
  officialVerdict,
  waitingForSite,
} from './official.mjs';
import {assignReaders, outstandingJobs, readResults} from './readers.mjs';
import {auditLines, formatReport, officialLines} from './report.mjs';
import {selectCandidates, setSection, shrinkWarning} from './state.mjs';
import {fullName} from './text.mjs';
import {loadSeason, loadWriteChain} from './web.mjs';
import {writePhase} from './write.mjs';
import {
  PREVIEW_REL,
  cardDir,
  localDate,
  newRunId,
  readOfficial,
  readPreviewText,
  readRun,
  readSite,
  readState,
  takeDownload,
  writeOfficial,
  writeRun,
  writeSite,
} from './runstore.mjs';

const BATCH_SIZE = 15;
const PROTECTED_BRANCHES = ['master', 'main'];
/** The site's rarity facet for the five dataset rarities: "common;legendary;rare;super-rare;uncommon". */
const RARITY_FACET = RARITIES.map((r) => r.toLowerCase().replace(/ /g, '-'))
  .sort()
  .join(';');
const CLEARANCE_EXPIRED =
  'HTTP 403: the Cloudflare clearance expired; reload the tab and fetch again';

/**
 * A browser download, from this run's copy. One made by older browser code is removed, so
 * the retry takes the fresh download instead of finding the stale copy again.
 */
function readBundle(file) {
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (bundle.version !== BROWSER_API_VERSION) {
    fs.rmSync(file, {force: true});
    throw new UsageError(
      `${path.basename(file)} came from browser code ${bundle.version}; expected ${BROWSER_API_VERSION}. It was removed: re-install the snippet, run that browser step again, then rerun this command.`,
    );
  }
  return bundle;
}

/**
 * A run for every step after `start`. A run opened before the official gate (issue #574)
 * never had its cards checked against the official list, so it cannot go on.
 */
function openRun(runId) {
  const run = readRun(runId);
  if (!run.official) {
    throw new UsageError(
      `run ${runId} was opened before the official gate (issue #574), so its cards were never checked against the official list. Start a new run.`,
    );
  }
  return run;
}

/** This set's cards already in previewCards.json, as {id, number, name}. */
function presentCards(setCode) {
  return JSON.parse(readPreviewText())
    .cards.filter((c) => String(c.setCode) === String(setCode))
    .map((c) => ({id: c.id, number: c.number ?? null, name: c.fullName}));
}

/* ------------------------------------------------------------------ start */

function assertCleanBranch() {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (PROTECTED_BRANCHES.includes(branch)) {
    throw new UsageError(`on ${branch}: switch to a fresh branch from origin/master first`);
  }
  if (git('status', '--porcelain', '--untracked-files=no')) {
    throw new UsageError('the working tree has uncommitted changes');
  }
  return branch;
}

function assertFreshBase(args) {
  git('fetch', '--quiet', 'origin', 'master');
  if (args.includes('--allow-non-master-base')) return;
  if (git('rev-parse', 'HEAD') !== git('rev-parse', 'origin/master')) {
    throw new UsageError(
      'HEAD is not origin/master: branch from a fresh origin/master (--allow-non-master-base is for testing the skill itself)',
    );
  }
}

/** The official list, or a UsageError that ends the run before it opens: no list, no run. */
async function loadOfficialList(season) {
  try {
    return await fetchOfficialList(season);
  } catch (error) {
    if (!(error instanceof OfficialListError)) throw error;
    throw new UsageError(`official list unavailable: ${error.message}`);
  }
}

async function start(args) {
  const branch = assertCleanBranch();
  assertFreshBase(args);
  const baseBlob = git('rev-parse', `origin/master:${PREVIEW_REL}`);
  if (git('hash-object', PREVIEW_REL) !== baseBlob) {
    throw new UsageError('previewCards.json differs from origin/master');
  }
  const season = await loadSeason();
  const official = await loadOfficialList(season);
  const run = {
    runId: newRunId(),
    startedAt: new Date().toISOString(),
    today: localDate(),
    season,
    branch,
    baseBlob,
    official: officialSummary(official, season.setTotal),
    audit: leakAudit(presentCards(season.setCode), official),
    cards: {},
  };
  writeRun(run);
  writeOfficial(run.runId, official);
  const discover = {setSlug: season.setSlug, rarities: RARITY_FACET, runId: run.runId};
  const findings = run.audit.length;
  say(
    `Run ${run.runId} opened for Set ${season.setCode} (${season.setName}) on ${branch}.`,
    ...officialLines(run),
    `Leak audit: ${findings} finding${findings === 1 ? '' : 's'}.`,
    ...auditLines(run),
    '',
    'In the lorcanaplayer tab: install the snippet, then discover the set:',
    `  await __revealSync.discover(${JSON.stringify(discover)})`,
    '',
    `Then: node scripts/reveal-sync/run.mjs candidates ${run.runId}`,
  );
}

/* ------------------------------------------------------------- candidates */

/** The slugs named by `--only a,b` or `--only=a,b`, or null when the flag is absent. */
function onlyList(args) {
  const inline = args.find((arg) => arg.startsWith('--only='));
  if (inline) return inline.slice('--only='.length).split(',').filter(Boolean);
  const at = args.indexOf('--only');
  if (at === -1) return null;
  return (args[at + 1] ?? '').split(',').filter(Boolean);
}

/** Without --only, the new and retryable cards. With it, exactly the named cards on the site. */
function chooseCandidates(slugs, section, only) {
  if (!only) return {chosen: selectCandidates(slugs, section), absent: []};
  const onSite = new Set(slugs);
  return {chosen: only.filter((s) => onSite.has(s)), absent: only.filter((s) => !onSite.has(s))};
}

/** An official card lorcanaplayer has not got yet, as the report lists it. */
function waitingRecord(entry) {
  return {
    number: entry.set_number,
    name: officialFullName(entry),
    revealedOn: entry.reveal_timestamp.slice(0, 10),
    revealedBy: entry.revealed_by,
  };
}

/**
 * Official main-set cards lorcanaplayer has not got yet: no card in Inkweave, in state or in
 * this run accounts for their number, and no slug on the site carries their name.
 */
function refreshWaiting(run, section) {
  const numbers = [
    ...presentCards(run.season.setCode).map((card) => card.number),
    ...run.site.slugs.map((slug) => section.cards[slug]?.number),
    ...Object.values(run.cards).map((card) => card.number),
  ].filter((n) => n != null);
  const coverage = {slugs: run.site.slugs, numbers};
  const waiting = waitingForSite(readOfficial(run.runId), coverage, run.season.setTotal);
  run.waiting = waiting.map(waitingRecord);
}

async function candidates([runId, ...args]) {
  const run = openRun(runId);
  const index = readBundle(await takeDownload(`reveal-sync-${runId}-index.json`, runId));
  if (!index.slugs.length) {
    throw new UsageError(
      `the site listed no cards for cardset=${run.season.setSlug}; check the set slug`,
    );
  }
  const section = setSection(readState(), run.season.setCode);
  const warning = shrinkWarning(section, index.slugs.length);
  if (warning) say(warning, '');
  const {chosen, absent} = chooseCandidates(index.slugs, section, onlyList(args));
  if (absent.length) say(`Not in the site's index, so not fetched: ${absent.join(', ')}`);
  run.site = {pages: index.pages, total: index.slugs.length, slugs: index.slugs};
  run.candidates = chosen;
  refreshWaiting(run, section);
  writeRun(run);
  say(
    `Site: ${run.site.total} cards on ${index.pages.length} pages (${index.pages.join(', ')}). To fetch: ${chosen.length}.`,
  );
  if (!chosen.length) {
    summarize(run);
    return say('Nothing new or retryable. Done.');
  }
  say('', 'Fetch each batch in the lorcanaplayer tab:');
  for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
    const options = {runId, batch: i / BATCH_SIZE + 1};
    say(
      `  await __revealSync.fetchCards(${JSON.stringify(chosen.slice(i, i + BATCH_SIZE))}, ${JSON.stringify(options)})`,
    );
  }
  say('', `Then: node scripts/reveal-sync/run.mjs ingest ${runId}`);
}

/* ----------------------------------------------------------------- ingest */

function pageFailure(fetched) {
  if (fetched.status === 403) return CLEARANCE_EXPIRED;
  return [`HTTP ${fetched.status}`, fetched.error].filter(Boolean).join(' ');
}

/** Only a page the parser rejects is "unreadable"; anything else is a bug and must surface. */
function parseSite(fetched) {
  try {
    return {
      site: parseCardLines(fetched.lines, {slug: fetched.slug, imageFile: fetched.imageFile}),
    };
  } catch (error) {
    if (!(error instanceof SiteRecordError)) throw error;
    return {failure: {status: 'error', reason: 'page-unreadable', detail: error.message}};
  }
}

/**
 * A card the official list lets through: the official number when lorcanaplayer showed none,
 * then lorcanaplayer's own gates, then the official scan. Ends 'reading', ready for its first
 * reader, or with the reason it stopped. `base` is the run card so far ({number, title}).
 */
async function admitCard(run, slug, {site, base, verdict}) {
  const card = {...base};
  if (verdict.adoptedNumber != null) {
    site.collector = {number: verdict.adoptedNumber, total: run.season.setTotal};
    writeSite(run.runId, slug, site);
    card.number = verdict.adoptedNumber;
    card.gateNotes = ['collector number from the official list'];
  }
  const gate = gateCard(site, run.season);
  if (gate.status !== 'pass') return {...card, ...gate};
  const scan = await downloadOfficialImage(verdict.entry, slug, cardDir(run.runId, slug));
  if (scan.status) return {...card, ...scan};
  if (scan.fallback) {
    const note = `scan from ${scan.url}: the official list's own filename for it was missing`;
    card.gateNotes = [...(card.gateNotes ?? []), note];
  }
  const official = officialIdentity(verdict.entry);
  return {...card, status: 'reading', image: OFFICIAL_IMAGE, official};
}

/** Identity first: a card already in Inkweave is known, whatever the official list says of it. */
async function ingestCard(run, fetched, present, official) {
  if (fetched.status !== 200 || fetched.error) {
    return {status: 'error', reason: 'fetch-failed', detail: pageFailure(fetched)};
  }
  const {site, failure} = parseSite(fetched);
  if (failure) return failure;
  writeSite(run.runId, fetched.slug, site);
  const base = {number: site.collector?.number ?? null, title: fullName(site.name, site.version)};
  const verdict = existingVerdict(site, present) ?? officialVerdict(site, official);
  if (verdict.status !== 'pass') return {...base, ...verdict};
  return admitCard(run, fetched.slug, {site, base, verdict});
}

/** Candidates no batch covered become errors, so they show in the report and are retried. */
function markUnfetched(run) {
  for (const slug of run.candidates) {
    run.cards[slug] ??= {
      status: 'error',
      reason: 'fetch-failed',
      detail: 'no batch file held this card',
    };
  }
}

/** Every card waiting for its first reader gets one. */
function assignFirstReaders(run) {
  for (const [slug, card] of entries(run, 'reading')) {
    if (!card.jobs?.length) assignReaders(run, slug, 1);
  }
}

async function ingest([runId]) {
  const run = openRun(runId);
  const present = presentCards(run.season.setCode);
  const official = readOfficial(runId);
  run.ingested ??= [];
  const batches = Math.ceil(run.candidates.length / BATCH_SIZE);
  for (let batch = 1; batch <= batches; batch++) {
    if (run.ingested.includes(batch)) continue;
    const bundle = readBundle(
      await takeDownload(`reveal-sync-${runId}-cards-${batch}.json`, runId),
    );
    for (const fetched of bundle.cards) {
      run.cards[fetched.slug] = await ingestCard(run, fetched, present, official);
    }
    run.ingested.push(batch);
    writeRun(run);
  }
  markUnfetched(run);
  assignFirstReaders(run);
  refreshWaiting(run, setSection(readState(), run.season.setCode));
  writeRun(run);
  summarize(run);
  printJobs(run);
}

/* ------------------------------------------------------------- adjudicate */

function decideCard(run, slug, card, readers) {
  const site = readSite(run.runId, slug);
  const result = adjudicate(site, readers, {overrides: card.overrides, official: card.official});
  if (result.decision === 'escalate') {
    assignReaders(run, slug, result.needReaders);
    return {status: 'reading'};
  }
  if (result.decision === 'defer') {
    return {
      status: 'deferred',
      reason: result.reason,
      detail: result.detail,
      readers: readers.length,
    };
  }
  const notes = [...(card.gateNotes ?? []), ...result.notes];
  const settled = {readers: readers.length, notes, conflicts: result.conflicts};
  // "unsettled": the site and the readers could not settle a field, because they disagree
  // or because the image cannot show it. The owner rules on it with `resolve`.
  if (result.decision === 'conflict') return {...settled, status: 'conflict', reason: 'unsettled'};
  return {...settled, status: 'ready', reason: undefined, card: result.card};
}

async function adjudicateRun([runId]) {
  const run = openRun(runId);
  for (const [slug, card] of entries(run, 'reading')) {
    const {readers, missing, invalid} = readResults(run, card);
    if (!missing.length && !invalid.length)
      Object.assign(card, decideCard(run, slug, card, readers));
  }
  writeRun(run);
  summarize(run);
  printJobs(run);
}

/* ---------------------------------------------------------------- resolve */

/**
 * Runs `action`, turning a RulingError into a UsageError: a ruling that cannot be applied is
 * a message for the owner. Any other error is a bug, and keeps its stack trace.
 */
function asUsageError(action) {
  try {
    return action();
  } catch (error) {
    if (!(error instanceof RulingError)) throw error;
    throw new UsageError(error.message);
  }
}

/** Prints the card's status after a ruling, naming any field still disputed. */
function sayStatus(slug, card) {
  const disputed = card.conflicts?.map((c) => c.field).join(', ');
  say(`${slug}: ${card.status}${disputed ? ` (still disputed: ${disputed})` : ''}`);
}

/**
 * The owner's ruling on a field the two sites disagree on ("site", "official" or a value).
 * Every ruling so far is applied to the card's record and the official check runs again;
 * once nothing is disputed the card goes on to its scan and a reader, in this run.
 */
async function resolveSites(run, slug, field, ruling) {
  const card = run.cards[slug];
  const official = readOfficial(run.runId);
  const rulings = {...card.officialRulings, [field]: ruling};
  const ruled = asUsageError(() =>
    applyOfficialRulings(readSite(run.runId, slug), official, rulings),
  );
  writeSite(run.runId, slug, ruled.site);
  const title = fullName(ruled.site.name, ruled.site.version);
  const base = {number: card.number, title, officialRulings: rulings};
  const verdict = officialVerdict(ruled.site, official, {accepted: ruled.accepted});
  run.cards[slug] =
    verdict.status === 'pass'
      ? await admitCard(run, slug, {site: ruled.site, base, verdict})
      : {...base, ...verdict};
  assignFirstReaders(run);
  writeRun(run);
  sayStatus(slug, run.cards[slug]);
  printJobs(run);
}

async function resolve([runId, slug, assignment = '']) {
  const run = openRun(runId);
  const card = run.cards[slug];
  const [field, ...value] = assignment.split('=');
  if (!card || !field || !value.length)
    throw new UsageError('usage: resolve <run> <slug> <field>=<site|official|value>');
  const ruling = value.join('=');
  if (card.reason === 'official-mismatch') return resolveSites(run, slug, field, ruling);
  if (card.reason !== 'unsettled') {
    throw new UsageError(
      `${slug} is ${card.status} (${card.reason}); only a field the site and the readers could not settle, or one the two sites disagree on, can be ruled on here`,
    );
  }
  const {readers, missing, invalid} = readResults(run, card);
  if (missing.length || invalid.length) {
    throw new UsageError(`${slug} has reader results missing or unusable; run adjudicate first`);
  }
  card.overrides = {...card.overrides, [field]: ruling};
  asUsageError(() => Object.assign(card, decideCard(run, slug, card, readers)));
  writeRun(run);
  sayStatus(slug, card);
}

/* ------------------------------------------------------------------ write */

async function write([runId]) {
  const run = openRun(runId);
  const reading = entries(run, 'reading');
  if (reading.length)
    throw new UsageError(`${reading.length} card(s) still need readers; run adjudicate first`);
  assertCleanBranch();
  const {written, section} = writePhase(run, await loadWriteChain());
  writeRun(run);
  say(formatReport(run, section, localDate()), '');
  say(
    `Changed: previewCards.json (+${written} cards), card-images-preview/ (their art), scripts/reveal-sync/state.json`,
    'Next:',
    '  git status                    review what changed',
    '  pnpm precompute-synergies     refresh local synergy data (git-ignored; CI builds its own)',
    '  /commit-and-push              commit and open the PR',
  );
}

/* ----------------------------------------------------------------- output */

function summarize(run) {
  say(formatReport(run, setSection(readState(), run.season.setCode), localDate()), '');
}

function printJobs(run) {
  const jobs = outstandingJobs(run, entries(run, 'reading'));
  if (!jobs.length) {
    return say(
      `No reader jobs outstanding. Next: node scripts/reveal-sync/run.mjs write ${run.runId}`,
    );
  }
  say(
    `${jobs.length} reader job(s). Give each reader only its image and dir, with the SKILL.md prompt.`,
    `Then: node scripts/reveal-sync/run.mjs adjudicate ${run.runId}`,
  );
  for (const job of jobs) {
    const rerun = job.problem ? ` (rerun: previous ${job.problem})` : '';
    say('', `READ ${job.slug} r${job.n}${rerun}`, `  image: ${job.image}`, `  dir:   ${job.dir}`);
  }
}

function report([runId]) {
  const run = readRun(runId);
  if (!run.official) {
    say('warning: this run was opened before the official gate (issue #574); start a new run', '');
  }
  summarize(run);
}

function snippet() {
  process.stdout.write(`${installSnippet()}\n`);
}

/* ------------------------------------------------------------------- main */

const COMMANDS = {
  start,
  snippet,
  candidates,
  ingest,
  adjudicate: adjudicateRun,
  resolve,
  write,
  report,
};

async function main([command, ...args]) {
  if (!COMMANDS[command])
    throw new UsageError(`usage: run.mjs <${Object.keys(COMMANDS).join('|')}> ...`);
  await COMMANDS[command](args);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch((error) => {
    console.error(error instanceof UsageError ? error.message : error);
    process.exit(1);
  });
}
