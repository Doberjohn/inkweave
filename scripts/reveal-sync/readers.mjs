/**
 * Blind reader jobs.
 *
 * Each job is a folder named by a random token, holding nothing but a copy of the card's
 * image. The reader works and writes result.json there. The folder name says nothing about
 * the card (a slug would spell the site's name and version, the very fields the reader is
 * there to confirm), the site's record is never beside the image, and no two readers share
 * a folder. Which token belongs to which card lives only in run.json.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {parseReaderResult} from './adjudicate.mjs';
import {blindDir, cardDir} from './runstore.mjs';

const imageName = (card) => `card${path.extname(card.image)}`;

/** Give a card `count` more readers, each with its own anonymous folder and image copy. */
export function assignReaders(run, slug, count) {
  const card = run.cards[slug];
  const source = path.join(cardDir(run.runId, slug), card.image);
  for (let i = 0; i < count; i++) {
    const token = crypto.randomBytes(6).toString('hex');
    const dir = blindDir(run.runId, token);
    fs.mkdirSync(dir, {recursive: true});
    fs.copyFileSync(source, path.join(dir, imageName(card)));
    card.jobs = [...(card.jobs ?? []), token];
  }
}

/** One job's result: {reader}, {missing: true} when not written yet, or {problem}. */
function readOne(file) {
  let text;
  try {
    text = fs.readFileSync(file, 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return {missing: true};
    return {problem: error.message};
  }
  try {
    return {reader: parseReaderResult(text)};
  } catch (error) {
    return {problem: `result.json ${error.message}`};
  }
}

/**
 * Every assigned reader's result. A job that has not written result.json yet is `missing`;
 * one whose file is unreadable or not a JSON object is `invalid`, with the reason, so a
 * reader that keeps producing bad output is visible instead of being quietly re-listed.
 */
export function readResults(run, card) {
  const readers = [];
  const missing = [];
  const invalid = [];
  (card.jobs ?? []).forEach((token, i) => {
    const result = readOne(path.join(blindDir(run.runId, token), 'result.json'));
    if (result.reader) readers.push(result.reader);
    else if (result.missing) missing.push(i + 1);
    else invalid.push({n: i + 1, reason: result.problem});
  });
  return {readers, missing, invalid};
}

/** Jobs still owed a usable result, as {slug, n, image, dir, problem}. */
export function outstandingJobs(run, cards) {
  const jobs = [];
  for (const [slug, card] of cards) {
    const {missing, invalid} = readResults(run, card);
    const owed = [
      ...missing.map((n) => ({n})),
      ...invalid.map(({n, reason}) => ({n, problem: reason})),
    ];
    for (const {n, problem} of owed) {
      const dir = blindDir(run.runId, card.jobs[n - 1]);
      jobs.push({slug, n, dir, image: path.join(dir, imageName(card)), problem});
    }
  }
  return jobs.sort((a, b) => a.slug.localeCompare(b.slug) || a.n - b.n);
}
