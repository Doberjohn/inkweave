// The rules every release notes file must pass: the JSON Schema and plain-text rules from #765,
// adapted to weekly files. The Weekly changelog draft routine checks the files it writes with the
// same rules (its validate_release_notes.py), so a file that passes there passes here too.
// notes.test.ts runs them on every file in ./notes, which keeps a malformed week from shipping.

import {RELEASE_NOTES_SECTIONS} from './types';

/** A value read from a notes file, and where it sits in it, such as `sections.new[0].title`. */
interface Field {
  path: string;
  value: unknown;
}

/** A text field and the most characters it may hold. */
interface TextRule {
  key: string;
  maxLength: number;
  optional?: boolean;
}

const WEEK_TEXT: TextRule[] = [
  {key: 'title', maxLength: 40},
  {key: 'summary', maxLength: 280},
  {key: 'behindTheScenes', maxLength: 280, optional: true},
];
const ITEM_TEXT: TextRule[] = [
  {key: 'title', maxLength: 80},
  {key: 'body', maxLength: 600},
];
const LINK_LABEL: TextRule = {key: 'label', maxLength: 60};

const WEEK_KEYS: ReadonlySet<string> = new Set([
  'schemaVersion',
  'week',
  'title',
  'summary',
  'sections',
  'behindTheScenes',
]);
const SECTION_KEYS: ReadonlySet<string> = new Set(RELEASE_NOTES_SECTIONS);
const ITEM_KEYS: ReadonlySet<string> = new Set(['title', 'body', 'highlight', 'link', 'prs']);

/** The most items a week marks as highlights. A quiet week marks none. */
const MAX_HIGHLIGHTS = 5;

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;
/** What Date's getUTCDay() returns for a Monday, the day every week starts. */
const MONDAY = 1;
/**
 * An in-app path: one leading slash, and no spaces or backslashes. Browsers read `//` and `/\`
 * alike as the start of another site's address, so `/\evil.com` would leave the site.
 */
const IN_APP_PATH = /^\/(?!\/)[^\s\\]*$/;
/**
 * The Reveals page, with or without a subpath, query or hash. Outside reveal season it redirects
 * home, so a link to it breaks. Routes match case-insensitively, so this does too.
 */
const REVEAL_SEASON_PATH = /^\/reveals(?:[/?#]|$)/i;
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/** What makes a text more than plain text, and how a problem names it. */
const NOT_PLAIN_TEXT: [RegExp, string][] = [
  // Doubled markers, a backtick, or a single * or _ around text (*so*, _so_). Like Markdown, it
  // reads neither 2 * 3 nor the _ inside snake_case as emphasis.
  [
    /\*\*|__|`|\*[^\s*](?:[^*]*[^\s*])?\*|(?<![A-Za-z0-9])_[^\s_](?:[^_]*[^\s_])?_(?![A-Za-z0-9])/,
    'Markdown emphasis or code',
  ],
  [/\]\(/, 'a Markdown link'],
  [/<\s*\/?\s*[A-Za-z]/, 'an HTML tag'],
  [/#\d+\b/, 'a PR or issue reference (PR numbers go in prs)'],
  [/[\r\n]/, 'a line break'],
];

/** Midnight UTC on a "YYYY-MM-DD" date. */
function utcDate(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

/** A date's month and day, such as "October 4". */
function monthAndDay(date: Date): string {
  return `${MONTH_NAMES[date.getUTCMonth()]} ${date.getUTCDate()}`;
}

/**
 * The heading a week's notes carry, Monday to Sunday: "2026-09-21" gives "September 21 to 27,
 * 2026", "2026-09-28" gives "September 28 to October 4, 2026", and a week across New Year names
 * both years.
 */
export function weekTitle(week: string): string {
  const monday = utcDate(week);
  const sunday = new Date(monday.getTime() + 6 * DAY_MS);
  const year = sunday.getUTCFullYear();
  if (monday.getUTCFullYear() !== year) {
    return `${monthAndDay(monday)}, ${monday.getUTCFullYear()} to ${monthAndDay(sunday)}, ${year}`;
  }
  // Sunday's month is named only when it isn't Monday's.
  const end =
    monday.getUTCMonth() === sunday.getUTCMonth() ? sunday.getUTCDate() : monthAndDay(sunday);
  return `${monthAndDay(monday)} to ${end}, ${year}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function child(parent: Field, key: string): Field {
  const path = parent.path ? `${parent.path}.${key}` : key;
  return {path, value: (parent.value as Record<string, unknown>)[key]};
}

function unknownKeyProblems(field: Field, allowed: ReadonlySet<string>): string[] {
  const where = field.path ? `${field.path}: ` : '';
  return Object.keys(field.value as object)
    .filter((key) => !allowed.has(key))
    .map((key) => `${where}unknown key "${key}"`);
}

/** Missing, too long, padded, or holding Markdown, HTML, a line break or a PR reference. */
function textProblems(parent: Field, rule: TextRule): string[] {
  const {path, value} = child(parent, rule.key);
  if (rule.optional && value === undefined) return [];
  if (typeof value !== 'string' || value.trim() === '') return [`${path}: must be non-empty text`];
  const problems = NOT_PLAIN_TEXT.filter(([pattern]) => pattern.test(value)).map(
    ([, found]) => `${path}: contains ${found}`,
  );
  // Code points, as JSON Schema and the routine's Python count them: an emoji is one character.
  const length = [...value].length;
  if (length > rule.maxLength) {
    problems.push(`${path}: ${length} characters, the limit is ${rule.maxLength}`);
  }
  if (value !== value.trim()) problems.push(`${path}: has leading or trailing spaces`);
  return problems;
}

/** Where a link goes: a path inside the site that stays valid, so never a reveal-season page. */
function linkTargetProblems({path, value}: Field): string[] {
  if (typeof value !== 'string' || !IN_APP_PATH.test(value)) {
    return [`${path}: must be an in-app path (one leading /, no spaces or backslashes)`];
  }
  if (REVEAL_SEASON_PATH.test(value)) {
    return [`${path}: links to a reveal-season page, which redirects home outside the season`];
  }
  return [];
}

function linkProblems(field: Field): string[] {
  const link = field.value;
  if (!isRecord(link) || Object.keys(link).sort().join() !== 'label,to') {
    return [`${field.path}: must be an object with exactly label and to`];
  }
  return [...textProblems(field, LINK_LABEL), ...linkTargetProblems(child(field, 'to'))];
}

function isPrNumber(value: unknown): boolean {
  return Number.isInteger(value) && (value as number) >= 1;
}

function prsProblems(field: Field): string[] {
  const prs = field.value;
  if (!Array.isArray(prs) || !prs.every(isPrNumber)) {
    return [`${field.path}: must be a list of PR numbers`];
  }
  return new Set(prs).size === prs.length ? [] : [`${field.path}: lists a PR twice`];
}

function itemProblems(field: Field): string[] {
  const item = field.value;
  if (!isRecord(item)) return [`${field.path}: must be an object`];
  const problems = [
    ...unknownKeyProblems(field, ITEM_KEYS),
    ...ITEM_TEXT.flatMap((rule) => textProblems(field, rule)),
  ];
  if ('highlight' in item && typeof item.highlight !== 'boolean') {
    problems.push(`${field.path}.highlight: must be true or false`);
  }
  if ('link' in item) problems.push(...linkProblems(child(field, 'link')));
  if ('prs' in item) problems.push(...prsProblems(child(field, 'prs')));
  return problems;
}

function sectionProblems(field: Field): string[] {
  const items = field.value;
  if (!Array.isArray(items) || items.length === 0) {
    return [`${field.path}: must be a non-empty list (leave the section out instead)`];
  }
  return items.flatMap((value, index) => itemProblems({path: `${field.path}[${index}]`, value}));
}

function sectionsProblems(field: Field): string[] {
  const sections = field.value;
  if (!isRecord(sections) || Object.keys(sections).length === 0) {
    return [`${field.path}: must be an object with at least one section`];
  }
  return [
    ...unknownKeyProblems(field, SECTION_KEYS),
    ...RELEASE_NOTES_SECTIONS.filter((key) => key in sections).flatMap((key) =>
      sectionProblems(child(field, key)),
    ),
  ];
}

function isHighlight(item: unknown): boolean {
  return isRecord(item) && item.highlight === true;
}

function highlightProblems(sections: unknown): string[] {
  if (!isRecord(sections)) return [];
  const items = Object.values(sections).filter(Array.isArray).flat();
  const count = items.filter(isHighlight).length;
  if (count <= MAX_HIGHLIGHTS) return [];
  return [`highlights: ${count} items are marked, mark at most ${MAX_HIGHLIGHTS}`];
}

/** A real calendar date, such as 2026-09-28: Date would read 2026-02-30 as March 2. */
function isCalendarDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = utcDate(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

function weekProblems(notes: Record<string, unknown>): string[] {
  const {week, title} = notes;
  if (!isCalendarDate(week)) return ['week: must be a date, YYYY-MM-DD'];
  if (utcDate(week).getUTCDay() !== MONDAY) {
    return [`week: ${week} is not a Monday, the day a week starts`];
  }
  const expected = weekTitle(week);
  return title === expected ? [] : [`title: should be "${expected}" for the week of ${week}`];
}

/** Everything wrong with a release notes file, one line each; empty when the file is valid. */
export function releaseNotesProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['the file must hold one JSON object'];
  const root: Field = {path: '', value};
  return [
    ...unknownKeyProblems(root, WEEK_KEYS),
    ...(value.schemaVersion === 2 ? [] : ['schemaVersion: must be 2']),
    ...weekProblems(value),
    ...WEEK_TEXT.flatMap((rule) => textProblems(root, rule)),
    ...sectionsProblems(child(root, 'sections')),
    ...highlightProblems(value.sections),
  ];
}
