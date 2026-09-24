/**
 * Adjudication: decide, field by field, what to write when the site record and one or more
 * blind readings of the card image are compared.
 *
 * Authority is per field because the two sources have different blind spots:
 *
 *   identity (name, version, collector number, ink, type)
 *       must agree. Readers can confirm the site but never overrule it: disagreement that
 *       survives escalation is a conflict for the owner.
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

const IDENTITY = ['name', 'version', 'collector', 'ink', 'type'];
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

/** A reader's JSON as a record comparable with the site's, for a card of the site's type. */
export function readerRecord(raw, siteType) {
  return {
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

function siteRecord(site) {
  const version = VERSIONLESS.has(site.type) ? '' : site.version;
  return {...site, version, collector: site.collector?.number ?? null, ink: site.inks};
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

function resolveField(field, site, readers) {
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

/** How a typed ruling becomes a field value; each returns null when it cannot. */
const LITERAL = {
  name: (v) => orNull(v.trim()),
  version: (v) => orNull(v.trim()),
  collector: toInt,
  type: baseType,
  ink: (v) => orNull(parseInks(v)),
  // A literal "\n" typed in a shell stays two characters; accept it as a line break.
  text: (v) => orNull(canonicalizeText(v.replace(/\\n/g, '\n').split('\n'))),
  subtypes: (v) => orNull(parseSubtypes(v)),
};

/** The owner's ruling as a value. Anything that does not parse is refused, never written as blank. */
function parseRuling(field, ruling) {
  const value = (LITERAL[field] ?? toInt)(String(ruling));
  if (value == null) throw new Error(`cannot read the ruling "${ruling}" as a ${field}`);
  return value;
}

/** The owner's ruling on a field: "site" takes the site's value, anything else is the value itself. */
function applyOverride(outcome, ruling, site) {
  if (ruling === undefined || outcome.status === 'agree') return outcome;
  const value = ruling === 'site' ? site[outcome.field] : parseRuling(outcome.field, ruling);
  const shown = ruling === 'site' ? "the site's value" : JSON.stringify(value);
  return {field: outcome.field, status: 'agree', value, dissent: 0, ruling: shown};
}

function noteFor(outcome, readerCount) {
  if (outcome.ruling !== undefined)
    return `${outcome.field}: resolved by the owner (${outcome.ruling})`;
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

/**
 * Compare a site record (from parseCardLines) with the readers' JSON.
 * `overrides` maps a field to the owner's ruling for it.
 */
export function adjudicate(site, rawReaders, {overrides = {}} = {}) {
  if (!rawReaders.length)
    return {decision: 'escalate', needReaders: 1, conflicts: [], notes: [], card: null};
  const record = siteRecord(site);
  const readers = rawReaders.map((raw) => readerRecord(raw, site.type));
  const outcomes = fieldsFor(site.type).map((field) =>
    applyOverride(resolveField(field, record, readers), overrides[field], record),
  );
  const decision = decide(outcomes);
  const card = decision === 'write' ? buildCard(site, outcomes) : null;
  return {
    decision,
    needReaders: decision === 'escalate' ? SETTLED - readers.length : 0,
    conflicts: outcomes
      .filter((o) => o.status === 'conflict')
      .map(({field, site: s, readers: r}) => ({field, site: s, readers: r})),
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
