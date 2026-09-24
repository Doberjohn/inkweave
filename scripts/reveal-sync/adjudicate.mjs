/**
 * Adjudication: decide, field by field, what to write when the site record and one or more
 * blind readings of the card image are compared.
 *
 * Authority is per field because the two sources have different blind spots:
 *
 *   identity (name, version, collector number, ink, type)
 *       must agree. Readers can confirm the site but never overrule it: disagreement that
 *       survives escalation is a conflict for the owner. The one exception is a version the
 *       official list (issue #574) gives differently: then three readers decide between the
 *       two sites' values, since the card they read is the official scan.
 *   image (cost, printed stats, card text, subtypes)
 *       printed on the card. The site's value is written when readers confirm it; a
 *       majority of readers may overrule it.
 *   site (inkable, rarity, franchise)
 *       never compared. Vision reads a rarity symbol and a frame ornament unreliably: in the
 *       2026-09-23 trial two blind readers agreed with each other and were both wrong about
 *       a card being inkable. Franchise is not printed on the card at all.
 *
 * One reader is the default. A disagreement asks for two more; with three, a field resolves
 * when the site and two readers agree, or (image fields only) when two readers agree against
 * the site. Detection comes from the site disagreeing, not from reader count, so a second
 * reader on an agreeing card would buy nothing.
 *
 * A field no reader could read is different from a disagreement. Card text and identity
 * fields still get two more readers: they decide which card this is and what the engine
 * reads. Classifications and stats go straight to the owner with the site's value shown
 * (owner's call, 2026-09-24): more readers of the same pixels rarely recover them, and each
 * extra read on a hard card costs ten minutes or more.
 *
 * The language code in the card's footer is checked like an identity field that must read
 * EN: the scan is what Inkweave ships, and a card is never translated. A reader who reads any
 * other language defers the card before anything else is compared; a code no reader could
 * read gets two more readers, then goes to the owner.
 */
import {
  baseType,
  canonicalizeText,
  comparable,
  comparableName,
  comparableText,
  deriveKeywords,
  parseCollector,
  parseInks,
  parseSubtypes,
  readClassifications,
  toInt,
} from './text.mjs';

const IDENTITY = ['name', 'version', 'collector', 'ink', 'type', 'language'];
const STATS = {
  Character: ['cost', 'strength', 'willpower', 'lore'],
  Location: ['cost', 'willpower', 'lore', 'moveCost'],
  Action: ['cost'],
  Item: ['cost'],
};
const SETTLED = 3;
const AGREEMENT = 2;
/** Fields that go straight to the owner, rather than to more readers, when no reader could read them. */
const ASK_WHEN_UNREADABLE = new Set([
  'cost',
  'strength',
  'willpower',
  'lore',
  'moveCost',
  'subtypes',
]);

/** The fields checked for a card of this type, identity first. */
export function fieldsFor(type) {
  return [...IDENTITY, ...STATS[type], 'text', 'subtypes'];
}

const isImageField = (field) => !IDENTITY.includes(field);
const lower = (s) => s.toLowerCase();
const same = (v) => v;
const isEmpty = (v) => Array.isArray(v) && v.length === 0;

/** Cards printed without a version. For these, "no version" is the reading, not a gap. */
const VERSIONLESS = new Set(['Action', 'Item']);

/** Comparison key per field. A null value is always "no reading" and never agrees. */
const KEYS = {
  name: comparableName,
  version: comparableName,
  collector: same,
  type: same,
  language: same,
  cost: same,
  strength: same,
  willpower: same,
  lore: same,
  moveCost: same,
  ink: (v) => (v.length ? v.join('-') : null),
  text: comparableText,
  subtypes: (v) => v.map(lower).sort().join('|'),
};

function keyOf(field, value) {
  return value == null ? null : KEYS[field](value);
}

/**
 * A reader's classification line. A missing value is no reading, and a line with a term
 * the reader could not read (flagged, or a "[illegible]" placeholder) is partial: it can
 * confirm the site's terms but never stand alone.
 */
function subtypeReading(raw) {
  const {terms, partial} = readClassifications(raw.classifications);
  const flagged = (raw.unreadable ?? []).includes('classifications');
  const partialSubtypes = partial || flagged;
  const readNothing = terms === null || (partialSubtypes && terms.length === 0);
  if (readNothing) return {subtypes: null, partialSubtypes: false};
  return {subtypes: terms, partialSubtypes};
}

/**
 * The language a reader read in the card's footer: "EN" for English in any spelling ("en",
 * "en-US", "English"), any other value as written, so "French" defers the card just as "FR"
 * does, or null when the reader could not read it.
 */
function readLanguage(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  return /^en(?:g|glish)?(?:[-_ ].*)?$/i.test(text) ? 'EN' : text.toUpperCase();
}

/** A reader's JSON as a record comparable with the site's, for a card of the site's type. */
export function readerRecord(raw, siteType) {
  return {
    language: readLanguage(raw.language),
    name: raw.name ?? null,
    version: VERSIONLESS.has(siteType) ? '' : (raw.version ?? null),
    collector: parseCollector(raw.collectorNumber)?.number ?? null,
    ink: parseInks(raw.inkColor),
    type: baseType(raw.type),
    cost: toInt(raw.cost),
    strength: toInt(raw.strength),
    willpower: toInt(raw.willpower),
    lore: toInt(raw.lore),
    moveCost: toInt(raw.moveCost),
    text: Array.isArray(raw.cardText) ? canonicalizeText(raw.cardText) : null,
    keywords: Array.isArray(raw.keywords) ? raw.keywords : [],
    ...subtypeReading(raw),
  };
}

/** The site's record in the readers' shape. Every card the pipeline writes must read English. */
function siteRecord(site) {
  const version = VERSIONLESS.has(site.type) ? '' : site.version;
  return {
    ...site,
    version,
    collector: site.collector?.number ?? null,
    ink: site.inks,
    language: 'EN',
  };
}

/** A reader who could not read every term agrees when what it did read is on the site's list. */
function subtypesAgree(siteTerms, reader) {
  if (reader.subtypes == null) return false;
  const site = new Set(siteTerms.map(lower));
  const read = reader.subtypes.map(lower);
  if (reader.partialSubtypes) return read.length > 0 && read.every((t) => site.has(t));
  return read.length === site.size && read.every((t) => site.has(t));
}

function agrees(field, site, reader) {
  if (field === 'subtypes') return subtypesAgree(site.subtypes, reader);
  const key = keyOf(field, reader[field]);
  return key !== null && key === keyOf(field, site[field]);
}

/**
 * Subtypes in the order printed on the card, spelled as the site spells them. When the
 * image could not read every term, the site's remaining terms fill the end.
 */
function printedSubtypes(siteTerms, agreeing) {
  const source = agreeing.find((r) => !r.partialSubtypes) ?? agreeing[0];
  const spell = (t) => siteTerms.find((s) => lower(s) === lower(t)) ?? t;
  const printed = source.subtypes.map(spell);
  const rest = siteTerms.filter((s) => !printed.some((t) => lower(t) === lower(s)));
  return [...printed, ...rest];
}

function agreed(field, site, agreeing, dissent = 0) {
  const value = field === 'subtypes' ? printedSubtypes(site.subtypes, agreeing) : site[field];
  return {field, status: 'agree', value, dissent};
}

/**
 * Majority keys are stricter than agreement keys: readers overruling the site must agree on
 * the card text line by line, or a reader that merged two abilities into one line could be
 * the one written, and keyword derivation would then miss the keyword on the merged line.
 */
const MAJORITY_KEYS = {text: (lines) => lines.map(comparable).filter(Boolean).join('\n')};

/**
 * Can this reading vote to overrule the site? Not when it read nothing, not a partial
 * subtype line, and never an empty reading against a site value that is not empty: two
 * readers returning no text must not turn a card into a vanilla one.
 */
function canVote(field, reader, site) {
  const value = reader[field];
  if (value == null) return false;
  if (field === 'subtypes' && reader.partialSubtypes) return false;
  return !isEmpty(value) || isEmpty(site[field]);
}

/** The reading at least two voting readers share, or null. */
function imageMajority(field, readers, site) {
  const keyFor = MAJORITY_KEYS[field] ?? ((value) => keyOf(field, value));
  const groups = new Map();
  for (const reader of readers.filter((r) => canVote(field, r, site))) {
    const key = keyFor(reader[field]);
    groups.set(key, [...(groups.get(key) ?? []), reader]);
  }
  const largest = [...groups.values()].sort((a, b) => b.length - a.length)[0];
  return largest?.length >= AGREEMENT ? largest[0][field] : null;
}

function conflictOn(field, site, readers) {
  return {field, status: 'conflict', site: site[field], readers: readers.map((r) => r[field])};
}

function unresolved(field, site, readers) {
  if (readers.length < SETTLED) return {field, status: 'escalate'};
  return conflictOn(field, site, readers);
}

/** A classification line or stat that no reader could read at all: the owner's call, now. */
function askOwnerNow(field, readers, agreeing) {
  if (agreeing.length || !ASK_WHEN_UNREADABLE.has(field)) return false;
  return readers.every((r) => r[field] == null);
}

/**
 * The official list's version when it differs from lorcanaplayer's, else null. Only the
 * version is settled here: the official gate already sent every other difference between the
 * two sites (name, ink, type, rarity) to the owner.
 */
function officialAlternative(field, site, official) {
  if (field !== 'version' || VERSIONLESS.has(site.type)) return null;
  const value = official?.version;
  if (!value || keyOf(field, value) === keyOf(field, site[field])) return null;
  return value;
}

/**
 * A version the two sites give differently. Three readers read the official scan, and the
 * site's value two of them read is written, whichever site it came from; otherwise the
 * owner decides, with both values shown.
 */
function resolveBetweenSites(field, site, readers, alternative) {
  if (readers.length < SETTLED) return {field, status: 'escalate'};
  const withSite = readers.filter((r) => agrees(field, site, r));
  if (withSite.length >= AGREEMENT) {
    const dissent = readers.length - withSite.length;
    return {...agreed(field, site, withSite, dissent), officialHad: alternative};
  }
  const asOfficial = {...site, [field]: alternative};
  const withOfficial = readers.filter((r) => agrees(field, asOfficial, r));
  if (withOfficial.length >= AGREEMENT)
    return {field, status: 'official', value: alternative, site: site[field]};
  return {...conflictOn(field, site, readers), official: alternative};
}

function resolveField(field, site, readers, official) {
  const alternative = officialAlternative(field, site, official);
  if (alternative !== null) return resolveBetweenSites(field, site, readers, alternative);
  const agreeing = readers.filter((r) => agrees(field, site, r));
  if (askOwnerNow(field, readers, agreeing)) return conflictOn(field, site, readers);
  if (readers.length === 1)
    return agreeing.length ? agreed(field, site, agreeing) : unresolved(field, site, readers);
  if (agreeing.length >= AGREEMENT)
    return agreed(field, site, agreeing, readers.length - agreeing.length);
  const majority = isImageField(field) ? imageMajority(field, readers, site) : null;
  if (majority !== null) return {field, status: 'image', value: majority, site: site[field]};
  return unresolved(field, site, readers);
}

const orNull = (value) => (value && value.length ? value : null);

/**
 * A ruling the owner typed that cannot be applied. The command line shows its message and
 * nothing else; any other error is a bug, and keeps its stack trace.
 */
export class RulingError extends Error {}

/** How a typed ruling becomes a field value; each returns null when it cannot. */
const LITERAL = {
  name: (v) => orNull(v.trim()),
  version: (v) => orNull(v.trim()),
  collector: toInt,
  type: baseType,
  ink: (v) => orNull(parseInks(v)),
  // Only English is ever written: any other language is a reason to wait, not a value.
  language: (v) => (readLanguage(v) === 'EN' ? 'EN' : null),
  // A literal "\n" typed in a shell stays two characters; accept it as a line break.
  text: (v) => orNull(canonicalizeText(v.replace(/\\n/g, '\n').split('\n'))),
  subtypes: (v) => orNull(parseSubtypes(v)),
};

/** The owner's ruling as a value. Anything that does not parse is refused, never written as blank. */
function parseRuling(field, ruling) {
  const value = (LITERAL[field] ?? toInt)(String(ruling));
  const article = /^[aeiou]/.test(field) ? 'an' : 'a';
  if (value == null) {
    throw new RulingError(`cannot read the ruling "${ruling}" as ${article} ${field}`);
  }
  return value;
}

/** The official list's value for the fields it carries: name, version, number, ink and type. */
function officialValue(field, official) {
  const carried = {
    name: official?.name,
    version: official?.version,
    collector: official?.number,
    ink: official?.ink,
    type: official?.type,
  };
  const value = carried[field];
  if (value == null) throw new RulingError(`the official list has no ${field} to rule with`);
  return value;
}

/** A ruling as a value, and how the note shows it: "site", "official", or the value itself. */
function ruledValue(field, ruling, site, official) {
  if (ruling === 'site') return {value: site[field], shown: "the site's value"};
  if (ruling === 'official')
    return {value: officialValue(field, official), shown: "the official list's value"};
  const value = parseRuling(field, ruling);
  return {value, shown: JSON.stringify(value)};
}

/** The owner's ruling on a field the readers could not settle. */
function applyOverride(outcome, ruling, site, official) {
  if (ruling === undefined || outcome.status === 'agree') return outcome;
  const {value, shown} = ruledValue(outcome.field, ruling, site, official);
  return {field: outcome.field, status: 'agree', value, dissent: 0, ruling: shown};
}

function noteFor(outcome, readerCount) {
  if (outcome.ruling !== undefined)
    return `${outcome.field}: resolved by the owner (${outcome.ruling})`;
  if (outcome.status === 'official')
    return `${outcome.field}: from the official list and the card; lorcanaplayer had ${JSON.stringify(outcome.site)}`;
  if (outcome.officialHad !== undefined)
    return `${outcome.field}: the card and lorcanaplayer agree on ${JSON.stringify(outcome.value)}; the official list has ${JSON.stringify(outcome.officialHad)}`;
  if (outcome.status === 'image')
    return `${outcome.field}: readers overrode the site (site had ${JSON.stringify(outcome.site)})`;
  if (outcome.dissent) {
    const agreeing = readerCount - outcome.dissent;
    return `${outcome.field}: ${outcome.dissent} of ${readerCount} readers disagreed; the site and ${agreeing} readers agree`;
  }
  return null;
}

function notesFor(outcomes, readers, card) {
  const notes = outcomes.map((o) => noteFor(o, readers.length)).filter(Boolean);
  if (readers.some((r) => r.partialSubtypes))
    notes.push('subtypes: a reader could not read every term; the site filled the gap');
  const readerKeywords = readers[0]?.keywords ?? [];
  if (card && readerKeywords.join('|') !== card.keywords.join('|')) {
    notes.push(
      `keywords: derived ${JSON.stringify(card.keywords)} from the text; the reader listed ${JSON.stringify(readerKeywords)}`,
    );
  }
  return notes;
}

function buildCard(site, outcomes) {
  const v = Object.fromEntries(outcomes.map((o) => [o.field, o.value]));
  const text = canonicalizeText(v.text);
  return {
    number: v.collector,
    name: v.name,
    version: v.version || null,
    type: v.type,
    inks: v.ink,
    cost: v.cost,
    strength: v.strength ?? null,
    willpower: v.willpower ?? null,
    lore: v.lore ?? null,
    moveCost: v.moveCost ?? null,
    subtypes: v.subtypes,
    text,
    keywords: deriveKeywords(text),
    inkwell: site.inkwell,
    rarity: site.rarity,
    franchise: site.franchise,
  };
}

function decide(outcomes) {
  if (outcomes.some((o) => o.status === 'conflict')) return 'conflict';
  if (outcomes.some((o) => o.status === 'escalate')) return 'escalate';
  return 'write';
}

/** A conflict as the report shows it, with the official value when the official list differed too. */
function conflictView({field, site, readers, official}) {
  return official === undefined ? {field, site, readers} : {field, site, official, readers};
}

/** The result for a card a reader read in another language: deferred, never translated. */
function notEnglish(language) {
  return {
    decision: 'defer',
    reason: 'scan-not-english',
    detail: `printed language ${language}`,
    needReaders: 0,
    conflicts: [],
    notes: [],
    card: null,
  };
}

/**
 * Compare a site record (from parseCardLines) with the readers' JSON.
 * `overrides` maps a field to the owner's ruling for it. `official` is the official list's
 * {name, version, number, ink, type} for the card (officialIdentity), when the run has one.
 */
export function adjudicate(site, rawReaders, {overrides = {}, official = null} = {}) {
  if (!rawReaders.length)
    return {decision: 'escalate', needReaders: 1, conflicts: [], notes: [], card: null};
  const readers = rawReaders.map((raw) => readerRecord(raw, site.type));
  const foreign = readers.find((r) => r.language && r.language !== 'EN');
  if (foreign) return notEnglish(foreign.language);
  const record = siteRecord(site);
  const outcomes = fieldsFor(site.type).map((field) => {
    const outcome = resolveField(field, record, readers, official);
    return applyOverride(outcome, overrides[field], record, official);
  });
  const decision = decide(outcomes);
  const card = decision === 'write' ? buildCard(site, outcomes) : null;
  return {
    decision,
    needReaders: decision === 'escalate' ? SETTLED - readers.length : 0,
    conflicts: outcomes.filter((o) => o.status === 'conflict').map(conflictView),
    notes: notesFor(outcomes, readers, card),
    card,
  };
}

/**
 * A reader's result.json as an object. Tolerates a code fence or stray text around the
 * object, and rejects anything that is not a plain object (null, a list, a quoted string),
 * which would otherwise read as a reader disagreeing on every field.
 */
const isPlainObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

export function parseReaderResult(text) {
  const candidates = [text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)];
  let problem = 'no JSON object found';
  for (const candidate of candidates) {
    try {
      const value = JSON.parse(candidate);
      if (isPlainObject(value)) return value;
      problem = `parsed to ${Array.isArray(value) ? 'a list' : JSON.stringify(value)}, not an object`;
    } catch (error) {
      problem = error.message;
    }
  }
  throw new Error(problem);
}

const blankIfNull = (n) => (n == null ? '' : String(n));

/** A written card as the reveal form's field values, ready for validateRevealCardForm and buildPreviewCard. */
export function toRevealForm(card) {
  return {
    collectorNumber: String(card.number),
    name: card.name,
    version: card.version ?? '',
    rarity: card.rarity,
    franchise: card.franchise ?? '',
    cost: String(card.cost),
    ink: card.inks[0],
    ink2: card.inks[1] ?? '',
    inkwell: card.inkwell,
    type: card.type,
    strength: blankIfNull(card.strength),
    willpower: blankIfNull(card.willpower),
    lore: blankIfNull(card.lore),
    moveCost: blankIfNull(card.moveCost),
    subtypes: card.subtypes.join(', '),
    keywords: card.keywords.join('\n'),
    fullText: card.text.join('\n'),
  };
}
