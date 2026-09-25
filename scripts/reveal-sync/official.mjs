/**
 * The official reveal list: illumineertales.com, the owner's reference for which cards are
 * officially revealed (issue #574). lorcanaplayer.com lists leaked cards next to official
 * reveals and does not mark the difference, so a card is only ever written once this list
 * shows it.
 *
 * The list is plain HTTPS JSON with no bot check, read here in Node. Its rules (what counts
 * as revealed, how scan filenames are built) are copied from the site's own app.js: the site
 * is the only authority on its own filenames, which keep an accent as a break ("he-ctor")
 * and can keep an old name after a card is renamed.
 */
import fs from 'node:fs';
import path from 'node:path';
import {RulingError} from './adjudicate.mjs';
import {RARITIES} from './gates.mjs';
import {baseType, comparableName, fullName, parseInks} from './text.mjs';

export const OFFICIAL_ORIGIN =
  process.env.REVEAL_SYNC_OFFICIAL_ORIGIN ?? 'https://illumineertales.com';
/** The file a card's official scan is saved as, in its run directory. */
export const OFFICIAL_IMAGE = 'image.webp';

/** The official list cannot be used. The run stops before anything is fetched or written. */
export class OfficialListError extends Error {}

/** The site's own test: a slot is revealed once it has a reveal time. */
export const isRevealed = (entry) => Boolean(entry?.reveal_timestamp);

/** The site's slugifyFilePart, byte for byte: NFKD without dropping the marks, so "Héctor" gives "he-ctor". */
export function fileSlug(value) {
  return String(value || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

/** The accent-free slug lorcanaplayer gives its card pages: "hector-rivera-worldwide-sensation". */
export function nameSlug(value) {
  return fileSlug(
    String(value || '')
      .normalize('NFKD')
      .replace(/\p{M}/gu, ''),
  );
}

const VERSIONLESS = new Set(['ACTION', 'ITEM']);
const titleCase = (word) => word.charAt(0) + word.slice(1).toLowerCase();

/** The version, for the card types that print one. */
const officialVersion = (entry) =>
  VERSIONLESS.has(entry.card_type) ? null : entry.subtitle || null;

/** "Fred - Big Stomper", or only the name for an Action or Item. */
export const officialFullName = (entry) => fullName(entry.name, officialVersion(entry));

/** A list of inks, or null when there is none to give. */
const inksOrNull = (inks) => (inks.length ? inks : null);

/** The official inks in lorcanaplayer's spelling (["EMERALD"] gives ["Emerald"]), or null. */
const officialInks = (entry) => inksOrNull(parseInks(entry.magic_ink_colors));

/** What the adjudicator weighs a card against, and what a ruling of "official" can take. */
export const officialIdentity = (entry) => ({
  name: entry.name,
  version: officialVersion(entry),
  number: entry.set_number,
  ink: officialInks(entry),
  type: baseType(entry.card_type),
});

/** One of the five dataset rarities in lorcanaplayer's spelling, or null: PROMO and "" are no opinion. */
function officialRarity(entry) {
  const spelled = String(entry.rarity ?? '')
    .split('_')
    .map(titleCase)
    .join(' ');
  return RARITIES.includes(spelled) ? spelled : null;
}

const inMainSet = (entry, setTotal) => entry.set_number >= 1 && entry.set_number <= setTotal;

/* ------------------------------------------------------------------- the list */

const CARD_TYPES = new Set(['CHARACTER', 'ACTION', 'ITEM', 'LOCATION']);
const READABLE = [
  (entry) => Number.isInteger(entry.set_number),
  (entry) => typeof entry.name === 'string' && entry.name.trim() !== '',
  (entry) => CARD_TYPES.has(entry.card_type),
  (entry) => Array.isArray(entry.magic_ink_colors),
];
const readable = (entry) => READABLE.every((check) => check(entry));

export const officialSetKey = (season) => `set-${season.setNumber}-${season.setSlug}`;

/** How the report names an entry: "#147 Lionheart". */
const entryLabel = (entry) => `#${entry.set_number} ${entry.name ?? ''}`.trim();

/**
 * A list's revealed entries. One the code cannot read is set aside in `unreadable`, rather
 * than failing the run or passing for an unrevealed slot.
 */
function revealedEntries(list, unreadable) {
  const revealed = (Array.isArray(list) ? list : []).filter(isRevealed);
  unreadable.push(...revealed.filter((entry) => !readable(entry)));
  return revealed.filter(readable);
}

/**
 * The season's revealed set cards and promos, and the revealed entries the code could not
 * read. Throws OfficialListError when the list is unusable.
 */
export function parseOfficialList(json, season) {
  const setKey = officialSetKey(season);
  const slots = json?.[setKey];
  if (!Array.isArray(slots)) {
    const found = Object.keys(json ?? {}).join(', ') || 'nothing';
    throw new OfficialListError(`no "${setKey}" in the official list (it has: ${found})`);
  }
  const unreadable = [];
  const cards = revealedEntries(slots, unreadable);
  const promos = revealedEntries(json.promos, unreadable);
  if (!cards.length) {
    const aside = unreadable.length ? ` (${unreadable.length} set aside as unreadable)` : '';
    throw new OfficialListError(
      `the official list shows no readable revealed card in "${setKey}"${aside}`,
    );
  }
  return {setKey, cards, promos, unreadable};
}

/**
 * An error's message with its cause. Node's fetch says only "fetch failed" and keeps the
 * reason (ENOTFOUND, a TLS failure, a reset) in `cause`, which the owner needs to see.
 */
function reasonOf(error) {
  const message = String(error?.message ?? error);
  const cause = error?.cause?.code ?? error?.cause?.message;
  return cause && !message.includes(cause) ? `${message} (${cause})` : message;
}

async function request(url, fetchImpl) {
  try {
    return await fetchImpl(url);
  } catch (error) {
    throw new OfficialListError(`${url}: ${reasonOf(error)}`, {cause: error});
  }
}

async function readJson(response, url) {
  let text;
  try {
    text = await response.text();
  } catch (error) {
    throw new OfficialListError(`${url}: the download broke off (${reasonOf(error)})`, {
      cause: error,
    });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new OfficialListError(`${url} is not valid JSON (${error.message})`, {cause: error});
  }
}

/** The official list for the season. Any failure is an OfficialListError: the run must not go on without it. */
export async function fetchOfficialList(season, {fetchImpl = fetch} = {}) {
  const url = `${OFFICIAL_ORIGIN}/cards.json`;
  const response = await request(url, fetchImpl);
  if (!response.ok) throw new OfficialListError(`${url}: HTTP ${response.status}`);
  const json = await readJson(response, url);
  return {
    fetchedAt: new Date().toISOString(),
    lastModified: response.headers.get('last-modified'),
    ...parseOfficialList(json, season),
  };
}

function utcMinute(httpDate) {
  const time = Date.parse(httpDate ?? '');
  if (Number.isNaN(time)) return 'unknown';
  return `${new Date(time).toISOString().slice(0, 16).replace('T', ' ')} UTC`;
}

/** What the report says about the list: how many main-set cards it shows and how fresh it is. */
export function officialSummary(official, setTotal) {
  return {
    revealed: official.cards.filter((entry) => inMainSet(entry, setTotal)).length,
    lastModified: utcMinute(official.lastModified),
    malformed: (official.unreadable ?? []).map(entryLabel),
  };
}

/* -------------------------------------------------------------------- scans */

const imageNumber = (entry) =>
  entry.promo_set
    ? `${fileSlug(entry.promo_set)}-${entry.set_number}`
    : String(entry.set_number).padStart(3, '0');

/**
 * Where the site keeps a card's scan: the URL its own page builds, then, when the card was
 * renamed after its reveal, the same number with lorcanaplayer's slug, since the file can
 * keep the name it was uploaded under.
 */
export function officialImageUrls(entry, siteSlug = null, size = 1024) {
  const query = entry.image_version ? `?v=${encodeURIComponent(entry.image_version)}` : '';
  const url = (base) => `${OFFICIAL_ORIGIN}/card-images/${base}-${size}.webp${query}`;
  const number = imageNumber(entry);
  const named = [number, fileSlug(entry.name), fileSlug(officialVersion(entry))]
    .filter(Boolean)
    .join('-');
  const urls = [url(named)];
  const fallback = siteSlug ? url(`${number}-${siteSlug}`) : null;
  if (fallback && !urls.includes(fallback)) urls.push(fallback);
  return urls;
}

/** The scan in a response, or the reason it is not one. An HTML page is never a scan. */
async function scanIn(response) {
  if (!response.ok) return {problem: `HTTP ${response.status}`};
  const type = response.headers.get('content-type') ?? 'no content type';
  if (!type.startsWith('image/webp')) return {problem: type};
  const bytes = Buffer.from(await response.arrayBuffer());
  return bytes.length ? {bytes} : {problem: 'empty body'};
}

/**
 * One URL's scan as bytes, or the reason it is not one. A request that fails, or a body that
 * breaks off halfway, is a failed URL: the card waits for the next run, the run goes on.
 */
async function fetchScan(url, fetchImpl) {
  try {
    return await scanIn(await fetchImpl(url));
  } catch (error) {
    return {problem: reasonOf(error)};
  }
}

/**
 * Save the card's official scan as `dir/image.webp`. Returns the URL it came from, and
 * whether that was the fallback, or a deferral naming every URL tried and why each failed;
 * the card is then retried next run.
 */
export async function downloadOfficialImage(entry, siteSlug, dir, {fetchImpl = fetch} = {}) {
  const urls = officialImageUrls(entry, siteSlug);
  const tried = [];
  for (const url of urls) {
    const {bytes, problem} = await fetchScan(url, fetchImpl);
    if (bytes) {
      fs.writeFileSync(path.join(dir, OFFICIAL_IMAGE), bytes);
      return {url, fallback: url !== urls[0]};
    }
    tried.push(`${url} (${problem})`);
  }
  return {status: 'deferred', reason: 'official-image-missing', detail: tried.join('; ')};
}

/* ----------------------------------------------------------------- matching */

/** Revealed entries the code could not read; an older run's snapshot may not have the key. */
const unreadableOf = (official) => official.unreadable ?? [];

/** A card by full name: a set card first, then a promo, then an entry the code could not read. */
function findByName(official, name) {
  const key = comparableName(name);
  const sameName = (entry) =>
    typeof entry.name === 'string' && comparableName(officialFullName(entry)) === key;
  const setCard = official.cards.find(sameName);
  if (setCard) return {entry: setCard, by: 'name'};
  const promo = official.promos.find(sameName);
  if (promo) return {entry: promo, by: 'promo'};
  const unreadable = unreadableOf(official).find(sameName);
  return unreadable ? {entry: unreadable, by: 'unreadable'} : null;
}

/** A set slot by collector number, readable or not. */
function findByNumber(official, number) {
  const entry = official.cards.find((c) => c.set_number === number);
  if (entry) return {entry, by: 'number'};
  const inSlot = (e) => !e.promo_set && e.set_number === number;
  const unreadable = unreadableOf(official).find(inSlot);
  return unreadable ? {entry: unreadable, by: 'unreadable'} : null;
}

/**
 * The official entry for a lorcanaplayer record, or null. A card with a collector number
 * is matched by that number only: a name found elsewhere on the list must not hide a slot
 * that is not revealed.
 */
export function matchOfficial(site, official) {
  const number = site.collector?.number;
  if (number == null) return findByName(official, fullName(site.name, site.version));
  return findByNumber(official, number);
}

/**
 * The fields both sites carry: where lorcanaplayer's record keeps it, the official value in
 * the same shape (null when the list has no opinion), how two values compare, and how an
 * owner's typed ruling is read.
 */
const FIELDS = {
  name: {
    key: 'name',
    official: (entry) => entry.name,
    compare: comparableName,
    parse: (value) => value.trim() || null,
  },
  ink: {
    key: 'inks',
    official: officialInks,
    compare: (inks) => [...inks].sort().join('|'),
    parse: (value) => inksOrNull(parseInks(value)),
  },
  type: {
    key: 'type',
    official: (entry) => baseType(entry.card_type),
    compare: (type) => type,
    parse: baseType,
  },
  rarity: {
    key: 'rarity',
    official: officialRarity,
    compare: (rarity) => rarity,
    parse: (value) => RARITIES.find((r) => r.toLowerCase() === value.trim().toLowerCase()) ?? null,
  },
};

function dispute(field, site, entry) {
  const rule = FIELDS[field];
  const official = rule.official(entry);
  if (official == null || rule.compare(official) === rule.compare(site[rule.key])) return null;
  return {field, site: site[rule.key], official};
}

const withArticle = (word) => `${/^[aeiou]/.test(word) ? 'an' : 'a'} ${word}`;

const describeDispute = ({field, site, official}) =>
  `${field}: site ${JSON.stringify(site)}; official ${JSON.stringify(official)}`;

const verdict = (status, reason, detail) => ({status, reason, detail});

function notRevealed(site) {
  const number = site.collector?.number;
  const detail =
    number == null
      ? 'illumineertales.com has no card by this name'
      : `illumineertales.com has not revealed #${number}`;
  return verdict('deferred', 'not-officially-revealed', detail);
}

/**
 * Whether the official list lets this card through. `accepted` names the fields the owner
 * has ruled on, which are no longer compared. A version difference never stops a card here:
 * the readers settle it against the printed card.
 */
export function officialVerdict(site, official, {accepted = []} = {}) {
  const match = matchOfficial(site, official);
  if (!match) return notRevealed(site);
  const {entry, by} = match;
  if (by === 'unreadable') {
    const detail = `illumineertales.com's entry ${entryLabel(entry)} could not be read`;
    return verdict('deferred', 'official-entry-unreadable', detail);
  }
  if (by === 'promo') {
    const promo = `official promo ${entry.promo_set} ${entry.set_number}`;
    return verdict('conflict', 'needs-reserved-band', `${promo}, no set number yet`);
  }
  if (entry.translation_url) {
    return verdict('deferred', 'scan-not-english', 'official reveal is not in English');
  }
  const conflicts = Object.keys(FIELDS)
    .filter((field) => !accepted.includes(field))
    .map((field) => dispute(field, site, entry))
    .filter(Boolean);
  if (conflicts.length) {
    const detail = conflicts.map(describeDispute).join('; ');
    return {...verdict('conflict', 'official-mismatch', detail), conflicts};
  }
  return {status: 'pass', entry, adoptedNumber: by === 'name' ? entry.set_number : null};
}

/**
 * The owner's ruling on a field the sites disagree on: "site" keeps lorcanaplayer's value,
 * "official" takes the list's, anything else is the value itself. Returns the amended record
 * and the field, which the official check then leaves alone. A value that does not parse
 * throws: nothing is ever written as blank.
 */
export function applyOfficialRuling(site, entry, field, ruling) {
  const rule = FIELDS[field];
  if (!rule) {
    const compared = Object.keys(FIELDS).join(', ');
    throw new RulingError(`"${field}" is not a field the two sites are compared on (${compared})`);
  }
  if (ruling === 'site') return {site, accepted: [field]};
  const value = ruling === 'official' ? rule.official(entry) : rule.parse(String(ruling));
  if (value == null) throw new RulingError(unusableRuling(field, ruling));
  return {site: {...site, [rule.key]: value}, accepted: [field]};
}

function unusableRuling(field, ruling) {
  if (ruling === 'official') return `the official list has no ${field} for this card`;
  return `cannot read the ruling "${ruling}" as ${withArticle(field)}`;
}

/** Every ruling a card has, applied in the order given. */
export function applyOfficialRulings(site, official, rulings) {
  const match = matchOfficial(site, official);
  if (!match) throw new RulingError('the card is no longer on the official list');
  let current = site;
  const accepted = [];
  for (const [field, ruling] of Object.entries(rulings)) {
    const applied = applyOfficialRuling(current, match.entry, field, ruling);
    current = applied.site;
    accepted.push(...applied.accepted);
  }
  return {site: current, accepted};
}

/* -------------------------------------------------------------------- audit */

/** An entry the code could not read is neither a leak nor a match: the owner checks it. */
const UNREADABLE_ENTRY = 'official entry unreadable: check it by hand';

function auditNumbered(card, official) {
  const found = findByNumber(official, card.number);
  if (!found) return 'not officially revealed';
  if (found.by === 'unreadable') return UNREADABLE_ENTRY;
  const name = officialFullName(found.entry);
  return comparableName(name) === comparableName(card.name)
    ? null
    : `name differs: official "${name}"`;
}

function auditNumberless(card, official) {
  const found = findByName(official, card.name);
  if (!found) return 'not officially revealed';
  const {entry, by} = found;
  if (by === 'unreadable') return UNREADABLE_ENTRY;
  if (by === 'promo') return `official promo ${entry.promo_set} ${entry.set_number}`;
  return `official as #${entry.set_number}: renumber it`;
}

/**
 * This set's cards already in Inkweave that the list does not show as revealed, or shows
 * under another name. `present`: [{id, number, name}]. Reported, never changed: removing a
 * card is the owner's call.
 */
export function leakAudit(present, official) {
  const problemWith = (card) =>
    card.number == null ? auditNumberless(card, official) : auditNumbered(card, official);
  return present
    .map((card) => ({id: card.id, name: card.name, problem: problemWith(card)}))
    .filter((finding) => finding.problem);
}

/**
 * Official main-set cards lorcanaplayer does not have yet, so none goes quietly missing.
 * `numbers`: collector numbers already accounted for (Inkweave, state, this run).
 * `slugs`: lorcanaplayer's index, matched on the accent-free name.
 */
export function waitingForSite(official, {slugs = [], numbers = []}, setTotal) {
  const onSite = new Set(slugs);
  const known = new Set(numbers);
  const covered = (entry) =>
    known.has(entry.set_number) || onSite.has(nameSlug(officialFullName(entry)));
  return official.cards.filter((entry) => inMainSet(entry, setTotal) && !covered(entry));
}
