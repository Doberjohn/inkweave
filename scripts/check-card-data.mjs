#!/usr/bin/env node
/**
 * Card data guard (#929, #932).
 *
 * The build writes its copies of the card files slimmed (`cardDataPlugin` in apps/web/vite.config.ts):
 * each card through the engine's `slimRawCard`, and, in a local-images build, without its `images`
 * links, which it moves into data/image-sources.json for the image restore. This guard checks a
 * build's copies against the repo's own (apps/web/public/data/, which keeps the full shape):
 *
 *   1. every card in allCards.json, previewCards.json and the set chunks transforms (the engine's
 *      `transformCard`) as the repo's copy does: the app reads the deployed data only through
 *      transformCard, so nothing on screen changes;
 *   2. every image link the repo's copies carry (promos.json's too) survives: in a build that wrote
 *      data/image-sources.json the record holds it, by id, and no card file holds an `images` key,
 *      on a card or a printing; in any other build, such as CI's E2E preview build, the built
 *      entry keeps its own. transformCard never reads the links, so check 1 can't see them.
 *
 * `.github/workflows/deploy.yml` runs it between `vercel build` and the deploy, so production never
 * ships card data that loses a card's text, keywords or art links. It passes `--expect-record`, since
 * production's build is a local-images one: a deploy build without data/image-sources.json lost
 * VITE_LOCAL_IMAGES, so it fails rather than pass as a build that keeps its links.
 *
 * Usage: node scripts/check-card-data.mjs [targetDir] [--expect-record]   (default: apps/web/dist)
 */
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {dirname, join, resolve} from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';
import {isDeepStrictEqual} from 'node:util';
import {indexById} from './lib/imageRestore.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DATA = join(ROOT, 'apps/web/public/data');
const IMAGE_SOURCES = 'image-sources.json';

/** The card files the build slims, as `cardDataFiles` in vite.config.ts lists them. */
export function cardFiles(dataDir) {
  const collection = join(dataDir, 'collection');
  const chunks = existsSync(collection)
    ? readdirSync(collection).filter((name) => name.endsWith('.json') && name !== 'index.json')
    : [];
  return ['allCards.json', 'previewCards.json', ...chunks.map((name) => `collection/${name}`)].filter((name) =>
    existsSync(join(dataDir, name)),
  );
}

/** A card file's cards, whether it is a list or an object with `cards`. */
const cardsOf = (data) => (Array.isArray(data) ? data : data.cards);

/** promos.json holds printings of other cards, with no text of their own, so check 1 leaves it out. */
const holdsCards = (name) => name !== 'collection/promos.json';

/** Every card and printing in the list, printings after their card, as the image restore indexes them. */
const entries = (cards) => [...indexById(cards).values()];

/** Check 1: a built card that transforms otherwise than the repo's, or a file whose cards differ. */
function transformProblems(name, repoCards, builtCards, transformCard) {
  if (repoCards.length !== builtCards.length) {
    return [`${name}: ${builtCards.length} built cards, ${repoCards.length} in the repo's copy`];
  }
  const problems = [];
  repoCards.forEach((card, i) => {
    if (!isDeepStrictEqual(transformCard(builtCards[i]), transformCard(card))) {
      problems.push(`${name}: card ${card.id} (${card.fullName}) transforms otherwise once built`);
    }
  });
  return problems;
}

/** Check 2: a built entry that still carries links the build moved into the record. */
function leftLinkProblems(name, builtCards) {
  return entries(builtCards)
    .filter((entry) => 'images' in entry)
    .map((entry) => `${name}: ${entry.id} still carries its image links`);
}

/** Check 2: a repo link the build kept nowhere, in the record or else in the built entry. */
function lostLinkProblems(name, repoCards, builtCards, record) {
  const builtById = record === null ? indexById(builtCards) : null;
  const where = record === null ? 'its built entry' : IMAGE_SOURCES;
  const kept = (id) => (record === null ? builtById.get(id)?.images : record[id]);
  return entries(repoCards)
    .filter((entry) => entry.images && !isDeepStrictEqual(kept(String(entry.id)), entry.images))
    .map((entry) => `${name}: ${where} lacks ${entry.id}'s image links`);
}

/** A guard that would check nothing, or a deploy build that never wrote its image record. */
function setupProblems(repo, record, expectRecord) {
  const problems = [];
  if (Object.keys(repo).length === 0) problems.push("no card files in the repo's data");
  if (expectRecord && record === null) problems.push(`${IMAGE_SOURCES}: missing from the build`);
  return problems;
}

/**
 * Every problem with a build's card files, given both copies' files by name ({name: parsed JSON})
 * and the build's image record, or null when the build kept its links in the card files.
 * `expectRecord` fails a build without the record.
 */
export function cardDataProblems({repo, built, record, transformCard, expectRecord = false}) {
  const problems = setupProblems(repo, record, expectRecord);
  for (const [name, data] of Object.entries(repo)) {
    if (!(name in built)) {
      problems.push(`${name}: missing from the build`);
      continue;
    }
    const repoCards = cardsOf(data);
    const builtCards = cardsOf(built[name]);
    if (holdsCards(name)) {
      problems.push(...transformProblems(name, repoCards, builtCards, transformCard));
    }
    if (record !== null) problems.push(...leftLinkProblems(name, builtCards));
    problems.push(...lostLinkProblems(name, repoCards, builtCards, record));
  }
  return problems;
}

const readJson = (file) => JSON.parse(readFileSync(file, 'utf8'));

async function main() {
  if (process.env.SKIP_CARD_DATA_GUARD === '1') {
    console.log('Card data guard skipped (SKIP_CARD_DATA_GUARD=1)');
    return;
  }
  const args = process.argv.slice(2);
  const expectRecord = args.includes('--expect-record');
  const target = args.find((arg) => !arg.startsWith('--')) ?? join(ROOT, 'apps/web/dist');
  const targetData = join(resolve(target), 'data');
  const names = cardFiles(REPO_DATA);
  const repo = Object.fromEntries(names.map((name) => [name, readJson(join(REPO_DATA, name))]));
  const built = Object.fromEntries(
    names.filter((name) => existsSync(join(targetData, name))).map((name) => [name, readJson(join(targetData, name))]),
  );
  const recordFile = join(targetData, IMAGE_SOURCES);
  const record = existsSync(recordFile) ? readJson(recordFile) : null;
  const {transformCard} = await import(pathToFileURL(join(ROOT, 'packages/synergy-engine/dist/card.js')).href);

  const problems = cardDataProblems({repo, built, record, transformCard, expectRecord});
  if (problems.length > 0) {
    console.error(`Card data guard failed (${problems.length}):`);
    for (const problem of problems.slice(0, 50)) console.error(`  - ${problem}`);
    if (problems.length > 50) console.error(`  ... and ${problems.length - 50} more`);
    process.exitCode = 1;
    return;
  }
  const count = names.filter(holdsCards).reduce((sum, name) => sum + cardsOf(repo[name]).length, 0);
  console.log(
    `Card data guard: ${count} cards in ${names.length} files transform as the repo's copies do` +
      (record === null ? ' (links kept in the card files)' : `, and ${IMAGE_SOURCES} holds every image link`),
  );
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
