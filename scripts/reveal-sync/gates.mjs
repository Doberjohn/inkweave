/**
 * Gates: cheap, deterministic checks that decide whether a card is worth a vision read.
 *
 * They run before any agent does, which is the main cost control. In the 2026-09-23 trial
 * five of nine cards would have stopped here. Each gate returns null to let the card
 * through, or a verdict with a machine-readable reason:
 *
 *   skipped   final; the card is not part of this set's reveal data
 *   deferred  not writable yet; retried on every later run
 *   conflict  needs the owner's decision; also retried
 */
import {comparableName, fullName} from './text.mjs';

/** The only rarities in the shipped dataset (1024 cards, no others). */
export const RARITIES = ['Common', 'Uncommon', 'Rare', 'Super Rare', 'Legendary'];

/**
 * The scan's language, read from the uploaded image's filename
 * ("147-204-EN-14-...", "27-204-JA-14-..."). Not from the page: it renders an "English"
 * label even on cards whose only scan is Japanese.
 */
export function scanLanguage(imageFile, setNumber) {
  const match = String(imageFile ?? '').match(new RegExp(`-([A-Z]{2})-${setNumber}-`));
  return match ? match[1] : null;
}

const verdict = (status, reason, detail) => ({status, reason, detail});

function checkSet(site, ctx) {
  return site.set === ctx.setName ? null : verdict('skipped', 'wrong-set', `set is "${site.set}"`);
}

function checkRarity(site) {
  return RARITIES.includes(site.rarity)
    ? null
    : verdict('skipped', 'rarity-excluded', `rarity is "${site.rarity}"`);
}

/** Never translate: the engine matches English text, and a translation has no second source to check it against. */
function checkLanguage(site, ctx) {
  const language = scanLanguage(site.imageFile, ctx.setNumber);
  if (!language)
    return verdict('deferred', 'language-unknown', `no language marker in ${site.imageFile}`);
  return language === 'EN' ? null : verdict('deferred', 'scan-not-english', language);
}

const VERSIONED = new Set(['Character', 'Location']);

/**
 * Why the site's record cannot be written yet. "None" is a real vanilla card; "Unknown"
 * means the site has stats but not abilities, and writing that as vanilla would give the
 * card zero synergies with no error anywhere. Every one of the 776 characters and 43
 * locations in the shipped data has a version, and every character has classifications, so
 * a record missing either is unfinished rather than unusual.
 */
const INCOMPLETE = [
  [(s) => s.keywordsField === 'Unknown', 'abilities listed as Unknown'],
  [(s) => !s.text.length && s.keywordsField !== 'None', 'no card text'],
  [(s) => s.inkwell === null, 'inkwell unknown'],
  [(s) => s.cost === null, 'ink cost unknown'],
  [(s) => !s.inks.length, 'ink colour unknown'],
  [(s) => VERSIONED.has(s.type) && !s.version, 'version missing'],
  [(s) => s.type === 'Character' && !s.subtypes.length, 'classifications missing'],
];

function incompleteBecause(site) {
  return INCOMPLETE.find(([missing]) => missing(site))?.[1] ?? null;
}

function checkComplete(site) {
  const why = incompleteBecause(site);
  return why ? verdict('deferred', 'site-record-incomplete', why) : null;
}

/** Preview ids are 14000 + collector number; without one the card belongs in the reserved band, set by hand. */
function checkCollector(site) {
  return site.collector
    ? null
    : verdict('conflict', 'needs-reserved-band', 'no readable collector number');
}

/** A number inside the set's own numbering, printed against the set's own total. */
function withinSet({number, total}, setTotal) {
  const inRange = number >= 1 && number <= setTotal;
  const sameTotal = total === null || total === setTotal;
  return inRange && sameTotal;
}

function checkNumbering(site, ctx) {
  if (withinSet(site.collector, ctx.setTotal)) return null;
  const {number, total} = site.collector;
  return verdict(
    'skipped',
    'outside-set-numbering',
    `#${number}/${total ?? '?'} is outside the ${ctx.setTotal}-card set`,
  );
}

function blockOwner(number, inkBlocks) {
  return (
    Object.keys(inkBlocks).find(
      (ink) => number >= inkBlocks[ink].first && number <= inkBlocks[ink].last,
    ) ?? null
  );
}

/** A set is numbered ink by ink; a dual-ink card sits in its first ink's block. */
function checkInkBlock(site, ctx) {
  const {number} = site.collector;
  const owner = blockOwner(number, ctx.inkBlocks);
  if (!owner || owner === site.inks[0]) return null;
  return verdict(
    'conflict',
    'ink-block-mismatch',
    `#${number} is in the ${owner} block, the site says ${site.inks[0]}`,
  );
}

const GATES = [
  checkSet,
  checkRarity,
  checkLanguage,
  checkComplete,
  checkCollector,
  checkNumbering,
  checkInkBlock,
];

/**
 * First gate that stops the card, or {status: 'pass'}.
 * `ctx`: {setName, setNumber, setTotal, inkBlocks: {Ink: {first, last}}}.
 */
export function gateCard(site, ctx) {
  for (const gate of GATES) {
    const stop = gate(site, ctx);
    if (stop) return stop;
  }
  return {status: 'pass'};
}

/**
 * Whether the card is already in Inkweave, matched on identity rather than on number alone.
 * A number alone would write a hand-added reserved-band card (it has no number) a second
 * time once the site shows its number, and would hide a real card behind a mistyped one.
 *
 * `present`: this set's preview cards as {id, number, name}, `name` being the full name.
 * Returns {status: 'known'}, a conflict naming the clash, or null when the card is new.
 */
export function existingVerdict(site, present) {
  const name = comparableName(fullName(site.name, site.version));
  const sameName = (card) => comparableName(card.name) === name;
  const byNumber = site.collector && present.find((card) => card.number === site.collector.number);
  if (byNumber) {
    if (sameName(byNumber)) return {status: 'known'};
    return verdict(
      'conflict',
      'number-taken',
      `#${byNumber.number} is already in Inkweave as "${byNumber.name}"`,
    );
  }
  const byName = present.find(sameName);
  if (!byName) return null;
  if (byName.number == null) {
    return verdict(
      'conflict',
      'in-reserved-band',
      `already in Inkweave as ${byName.id} with no number: renumber it by hand`,
    );
  }
  return verdict('conflict', 'name-taken', `already in Inkweave as #${byName.number}`);
}
