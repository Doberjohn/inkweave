#!/usr/bin/env node
/**
 * /fetch-reveals command line. Each subcommand is one step of a run; the skill
 * (.claude/skills/fetch-reveals/SKILL.md) runs them in order and does the browser and vision
 * work in between.
 *
 *   start [--allow-non-master-base]    check the branch, record the base, open a run
 *   snippet                            print the in-page code to install in the site's tab
 *   candidates <run> [--only a,b]      read the discovered index, list the cards to fetch;
 *                                      --only fetches the named cards whatever their state
 *   ingest <run>                       read the fetched pages, apply the gates, list reader jobs
 *   adjudicate <run>                   read the readers' results, decide, list any escalations
 *   resolve <run> <slug> <field>=<v>   record the owner's ruling on a field the readers disputed
 *   write <run>                        write verified cards, stage their art, update state
 *   report <run>                       print the report
 *
 * It never commits or pushes. `write` leaves changes in the working tree for the owner.
 */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {adjudicate} from './adjudicate.mjs';
import {BROWSER_API_VERSION, installSnippet} from './browser.mjs';
import {UsageError, entries, git, say} from './cli.mjs';
import {SiteRecordError, parseCardLines} from './extract-card.mjs';
import {RARITIES, existingVerdict, gateCard} from './gates.mjs';
import {assignReaders, outstandingJobs, readResults} from './readers.mjs';
import {formatReport} from './report.mjs';
import {selectCandidates, setSection, shrinkWarning} from './state.mjs';
import {fullName} from './text.mjs';
import {loadSeason, loadWriteChain} from './web.mjs';
import {writePhase} from './write.mjs';
import {
  PREVIEW_REL,
  cardDir,
  localDate,
  newRunId,
  readPreviewText,
  readRun,
  readState,
  takeDownload,
  writeRun,
} from './runstore.mjs';

const BATCH_SIZE = 15;
const PROTECTED_BRANCHES = ['master', 'main'];
/** The site's rarity facet for the five dataset rarities: "common;legendary;rare;super-rare;uncommon". */
const RARITY_FACET = RARITIES.map((r) => r.toLowerCase().replace(/ /g, '-'))
  .sort()
  .join(';');
const IMAGE_EXT = {'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp'};
const CLEARANCE_EXPIRED =
  'HTTP 403: the Cloudflare clearance expired; reload the tab and fetch again';

function readBundle(file) {
  const bundle = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (bundle.version !== BROWSER_API_VERSION) {
    throw new UsageError(
      `${path.basename(file)} came from browser code ${bundle.version}; expected ${BROWSER_API_VERSION}. Re-install the snippet.`,
    );
  }
  return bundle;
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

async function start(args) {
  const branch = assertCleanBranch();
  assertFreshBase(args);
  const baseBlob = git('rev-parse', `origin/master:${PREVIEW_REL}`);
  if (git('hash-object', PREVIEW_REL) !== baseBlob) {
    throw new UsageError('previewCards.json differs from origin/master');
  }
  const season = await loadSeason();
  const run = {
    runId: newRunId(),
    startedAt: new Date().toISOString(),
    today: localDate(),
    season,
    branch,
    baseBlob,
    cards: {},
  };
  writeRun(run);
  const discover = {setSlug: season.setSlug, rarities: RARITY_FACET, runId: run.runId};
  say(
    `Run ${run.runId} opened for Set ${season.setCode} (${season.setName}) on ${branch}.`,
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

async function candidates([runId, ...args]) {
  const run = readRun(runId);
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
  run.knownNumbers = presentCards(run.season.setCode)
    .map((c) => c.number)
    .filter((n) => n != null);
  writeRun(run);
  say(
    `Site: ${run.site.total} cards on ${index.pages.length} pages (${index.pages.join(', ')}). To fetch: ${chosen.length}.`,
  );
  if (!chosen.length) return say('Nothing new or retryable. Done.');
  say('', 'Fetch each batch in the lorcanaplayer tab:');
  for (let i = 0; i < chosen.length; i += BATCH_SIZE) {
    const options = {runId, batch: i / BATCH_SIZE + 1, knownNumbers: run.knownNumbers};
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

function imageProblem(image) {
  if (!image) return {reason: 'image-missing', detail: 'the page has no card image'};
  if (image.error === 403) return {reason: 'image-fetch-failed', detail: CLEARANCE_EXPIRED};
  if (image.error) return {reason: 'image-fetch-failed', detail: `HTTP ${image.error}`};
  if (!IMAGE_EXT[image.type])
    return {reason: 'image-unsupported', detail: `content type ${image.type}`};
  return null;
}

function readyForReaders(base, dir, image) {
  const problem = imageProblem(image);
  if (problem) return {...base, status: 'error', ...problem};
  const file = `image.${IMAGE_EXT[image.type]}`;
  fs.writeFileSync(path.join(dir, file), Buffer.from(image.base64, 'base64'));
  return {...base, status: 'reading', image: file};
}

/** Identity first: a card already in Inkweave is known whatever its scan's language. */
function ingestCard(run, fetched, present) {
  if (fetched.status !== 200 || fetched.error) {
    return {status: 'error', reason: 'fetch-failed', detail: pageFailure(fetched)};
  }
  const {site, failure} = parseSite(fetched);
  if (failure) return failure;
  const dir = cardDir(run.runId, fetched.slug);
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'site.json'), `${JSON.stringify(site, null, 2)}\n`);
  const base = {number: site.collector?.number ?? null, title: fullName(site.name, site.version)};
  const verdict = existingVerdict(site, present) ?? gateCard(site, run.season);
  if (verdict.status !== 'pass') return {...base, ...verdict};
  return readyForReaders(base, dir, fetched.image);
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

async function ingest([runId]) {
  const run = readRun(runId);
  const present = presentCards(run.season.setCode);
  run.ingested ??= [];
  const batches = Math.ceil(run.candidates.length / BATCH_SIZE);
  for (let batch = 1; batch <= batches; batch++) {
    if (run.ingested.includes(batch)) continue;
    const bundle = readBundle(
      await takeDownload(`reveal-sync-${runId}-cards-${batch}.json`, runId),
    );
    for (const fetched of bundle.cards) run.cards[fetched.slug] = ingestCard(run, fetched, present);
    run.ingested.push(batch);
    writeRun(run);
  }
  markUnfetched(run);
  for (const [slug, card] of entries(run, 'reading')) {
    if (!card.jobs?.length) assignReaders(run, slug, 1);
  }
  writeRun(run);
  summarize(run);
  printJobs(run);
}

/* ------------------------------------------------------------- adjudicate */

function decideCard(run, slug, card, readers) {
  const site = JSON.parse(
    fs.readFileSync(path.join(cardDir(run.runId, slug), 'site.json'), 'utf8'),
  );
  const result = adjudicate(site, readers, {overrides: card.overrides});
  if (result.decision === 'escalate') {
    assignReaders(run, slug, result.needReaders);
    return {status: 'reading'};
  }
  const settled = {readers: readers.length, notes: result.notes, conflicts: result.conflicts};
  // "unsettled": the site and the readers could not settle a field, because they disagree
  // or because the image cannot show it. The owner rules on it with `resolve`.
  if (result.decision === 'conflict') return {...settled, status: 'conflict', reason: 'unsettled'};
  return {...settled, status: 'ready', reason: undefined, card: result.card};
}

async function adjudicateRun([runId]) {
  const run = readRun(runId);
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

function resolve([runId, slug, assignment = '']) {
  const run = readRun(runId);
  const card = run.cards[slug];
  const [field, ...value] = assignment.split('=');
  if (!card || !field || !value.length)
    throw new UsageError('usage: resolve <run> <slug> <field>=<site|value>');
  if (card.reason !== 'unsettled') {
    throw new UsageError(
      `${slug} is ${card.status} (${card.reason}); only a field the site and the readers could not settle can be ruled on here`,
    );
  }
  const {readers, missing, invalid} = readResults(run, card);
  if (missing.length || invalid.length) {
    throw new UsageError(`${slug} has reader results missing or unusable; run adjudicate first`);
  }
  card.overrides = {...card.overrides, [field]: value.join('=')};
  try {
    Object.assign(card, decideCard(run, slug, card, readers));
  } catch (error) {
    throw new UsageError(error.message);
  }
  writeRun(run);
  const disputed = card.conflicts?.map((c) => c.field).join(', ');
  say(`${slug}: ${card.status}${disputed ? ` (still disputed: ${disputed})` : ''}`);
}

/* ------------------------------------------------------------------ write */

async function write([runId]) {
  const run = readRun(runId);
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
  summarize(readRun(runId));
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
