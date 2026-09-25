/**
 * The write phase: everything that changes the working tree, ordered so previewCards.json
 * is never ahead of the art.
 *
 *   1. every ready card goes through validateRevealCardForm, and is refused if its name is
 *      already in the set's preview data
 *   2. the accepted cards' scans are converted to AVIFs
 *   3. only the cards whose AVIFs now exist are inserted, and previewCards.json is written
 *      once, last; if that fails, the art this run produced is removed again
 *
 * A card that fails a step becomes a conflict with the reason, and is retried next run.
 */
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {toRevealForm} from './adjudicate.mjs';
import {UsageError, byNumber, entries, git, say} from './cli.mjs';
import {markVanished, recordOutcome, setSection} from './state.mjs';
import {comparableName, fullName, unaccentReferences, unaccented} from './text.mjs';
import {ROOT} from './web.mjs';
import {
  AVIF_DIR,
  PREVIEW_FILE,
  PREVIEW_REL,
  RAW_DIR,
  cardDir,
  readPreviewText,
  readState,
  writeState,
} from './runstore.mjs';

/** Run status -> state status. Cards still in flight are not recorded; the next run retries them. */
const STATE_STATUS = {
  known: 'written',
  written: 'written',
  deferred: 'deferred',
  conflict: 'conflict',
  skipped: 'skipped',
};
const VARIANTS = ['', '-sm'];

const avifPath = (id, suffix) => path.join(AVIF_DIR, `${id}${suffix}.avif`);
/** Production shows a preview image only when both variants exist. */
const hasArt = (id) => VARIANTS.every((suffix) => fs.existsSync(avifPath(id, suffix)));

/** previewCards.json must be exactly what the run started from, locally and on origin/master. */
function assertNoRace(run) {
  git('fetch', '--quiet', 'origin', 'master');
  if (git('rev-parse', `origin/master:${PREVIEW_REL}`) !== run.baseBlob) {
    throw new UsageError(
      'previewCards.json changed on origin/master since this run started, probably a card published through /admin/reveal. Nothing was written. Start a new run from a fresh origin/master.',
    );
  }
  if (git('hash-object', PREVIEW_REL) !== run.baseBlob) {
    throw new UsageError(
      'previewCards.json changed locally since this run started. Nothing was written.',
    );
  }
}

const nameKey = (form) => comparableName(fullName(form.name, form.version));

/**
 * A ready card as the reveal form, spelled the way Inkweave spells names: without accents
 * (the owner's rule, issue #582). The name, the version and every "named X" reference in the
 * text lose theirs, so a Shift line names the card as written; the rest stays as printed.
 */
export function writtenForm(card) {
  return toRevealForm({
    ...card,
    name: unaccented(card.name),
    version: unaccented(card.version),
    text: card.text.map(unaccentReferences),
  });
}

/** Why the chain or the preview data refuses this card, or null. `seen` holds ids and names. */
function problemWith(chain, form, image, seen) {
  const check = chain.validateRevealCardForm(form, seen.ids, image);
  if (!check.ok) return Object.values(check.errors).join('; ');
  if (seen.names.has(nameKey(form))) return 'a card with this name is already in the preview data';
  return null;
}

/** Step 1: the ready cards the write chain accepts, in collector-number order. */
function acceptReady(run, chain, previewText) {
  const cards = JSON.parse(previewText).cards;
  const sameSet = cards.filter((c) => String(c.setCode) === String(run.season.setCode));
  const seen = {
    ids: new Set(cards.map((c) => c.id)),
    names: new Set(sameSet.map((c) => comparableName(c.fullName))),
  };
  const accepted = [];
  for (const [slug, entry] of entries(run, 'ready').sort(byNumber)) {
    const form = writtenForm(entry.card);
    const problem = problemWith(chain, form, entry.image, seen);
    if (problem) {
      Object.assign(entry, {status: 'conflict', reason: 'validation-failed', detail: problem});
      continue;
    }
    const id = run.season.idBase + entry.card.number;
    seen.ids.add(id);
    seen.names.add(nameKey(form));
    accepted.push({slug, id, form, image: entry.image});
  }
  return accepted;
}

/** Copy each accepted card's scan to card-images-raw/{id}.ext; returns the files placed. */
function placeRaws(run, accepted) {
  fs.mkdirSync(RAW_DIR, {recursive: true});
  const placed = [];
  for (const {slug, id, image} of accepted) {
    const target = path.join(RAW_DIR, `${id}${path.extname(image)}`);
    if (fs.existsSync(target)) continue;
    fs.copyFileSync(path.join(cardDir(run.runId, slug), image), target);
    placed.push(target);
  }
  return placed;
}

/** Raw images this run did not place that the converter would still turn into new AVIFs. */
function warnAboutStrangers(placed) {
  const ours = new Set(placed.map((file) => path.basename(file)));
  const strangers = fs
    .readdirSync(RAW_DIR)
    .filter((file) => !ours.has(file) && !hasArt(path.parse(file).name));
  if (strangers.length) {
    say(
      `warning: card-images-raw also holds ${strangers.join(', ')} with no AVIFs yet; the converter will convert those too`,
    );
  }
}

function runConverter() {
  const script = path.join(ROOT, 'scripts/convert-preview-images.mjs');
  const result = spawnSync(process.execPath, [script], {cwd: ROOT, stdio: 'inherit'});
  return result.error ? -1 : result.status;
}

/** Remove AVIFs this run produced for an id; art that existed before the run is never touched. */
function removeProducedArt(id, hadArt) {
  if (hadArt.has(id)) return;
  for (const suffix of VARIANTS) fs.rmSync(avifPath(id, suffix), {force: true});
}

/**
 * Step 2: convert the accepted cards' scans. The converter skips ids that already have
 * AVIFs, so art uploaded by hand is never replaced. Returns the cards whose art is in place
 * and the ids whose AVIFs this run created.
 */
function stageArt(run, accepted) {
  if (!accepted.length) return {converted: [], produced: []};
  const hadArt = new Set(accepted.filter((a) => hasArt(a.id)).map((a) => a.id));
  const placed = placeRaws(run, accepted);
  try {
    warnAboutStrangers(placed);
    const exitCode = runConverter();
    if (exitCode !== 0)
      say(`warning: convert-preview-images exited ${exitCode}; checking each card's AVIFs`);
    for (const failed of accepted.filter((a) => !hasArt(a.id))) {
      const detail = `no AVIFs after conversion (converter exit ${exitCode})`;
      Object.assign(run.cards[failed.slug], {status: 'conflict', reason: 'art-failed', detail});
      removeProducedArt(failed.id, hadArt);
    }
    const converted = accepted.filter((a) => hasArt(a.id));
    return {converted, produced: converted.filter((a) => !hadArt.has(a.id)).map((a) => a.id)};
  } finally {
    for (const file of placed) fs.rmSync(file, {force: true});
  }
}

/**
 * Replace a file all at once: write a sibling temp file, then rename it over the original,
 * so a failure part-way (a full disk, a Windows file lock) leaves the original untouched
 * rather than truncated.
 */
function replaceFile(file, text) {
  const temp = `${file}.reveal-sync.tmp`;
  fs.writeFileSync(temp, text);
  try {
    fs.renameSync(temp, file);
  } catch (error) {
    fs.rmSync(temp, {force: true});
    throw error;
  }
}

/** Step 3: insert the converted cards and write previewCards.json once, or undo the art. */
function insertCards(run, chain, {converted, produced}, previewText) {
  if (!converted.length) return;
  try {
    let text = previewText;
    for (const {form} of converted)
      text = chain.insertCardIntoPreviewJson(text, chain.buildPreviewCard(form));
    replaceFile(PREVIEW_FILE, text);
  } catch (error) {
    for (const id of produced) removeProducedArt(id, new Set());
    throw new Error(
      `previewCards.json was not written (${error.message}); the art this run produced was removed`,
      {cause: error},
    );
  }
  for (const {slug, id} of converted) Object.assign(run.cards[slug], {status: 'written', id});
}

function updateState(run) {
  const state = readState();
  const section = setSection(state, run.season.setCode);
  for (const [slug, card] of Object.entries(run.cards)) {
    const status = STATE_STATUS[card.status];
    const outcome = {status, reason: card.reason, detail: card.detail, number: card.number};
    if (status) recordOutcome(section, slug, outcome, run.today);
  }
  run.retired = markVanished(run.site.slugs, section);
  section.indexTotal = run.site.total;
  writeState(state);
  return section;
}

/** Write the run's verified cards. Returns how many were written and the updated state section. */
export function writePhase(run, chain) {
  assertNoRace(run);
  const previewText = readPreviewText();
  const accepted = acceptReady(run, chain, previewText);
  const staged = stageArt(run, accepted);
  insertCards(run, chain, staged, previewText);
  return {written: staged.converted.length, section: updateState(run)};
}
