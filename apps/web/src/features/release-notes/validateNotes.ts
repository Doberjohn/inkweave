// The rules every release notes file must pass (#765): the JSON Schema in that issue, plus its
// plain-text and highlight rules. The Monthly changelog draft routine checks the files it writes
// with the same rules (its validate_release_notes.py), so a file that passes there passes here too.
// notes.test.ts runs them on every file in ./notes, which keeps a malformed month from shipping.

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

const MONTH_TEXT: TextRule[] = [
  {key: 'title', maxLength: 40},
  {key: 'summary', maxLength: 280},
  {key: 'behindTheScenes', maxLength: 280, optional: true},
];
const ITEM_TEXT: TextRule[] = [
  {key: 'title', maxLength: 80},
  {key: 'body', maxLength: 600},
];
const LINK_LABEL: TextRule = {key: 'label', maxLength: 60};

const MONTH_KEYS: ReadonlySet<string> = new Set([
  'schemaVersion',
  'month',
  'title',
  'summary',
  'sections',
  'behindTheScenes',
]);
const SECTION_KEYS: ReadonlySet<string> = new Set(RELEASE_NOTES_SECTIONS);
const ITEM_KEYS: ReadonlySet<string> = new Set(['title', 'body', 'highlight', 'link', 'prs']);

/** How many items a month marks as highlights. */
const HIGHLIGHTS = {min: 1, max: 5};

const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;
/**
 * An in-app path: one leading slash, and no spaces or backslashes. Browsers read `//` and `/\`
 * alike as the start of another site's address, so `/\evil.com` would leave the site.
 */
const IN_APP_PATH = /^\/(?!\/)[^\s\\]*$/;
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
  [/(?<![\w&])#\d+\b/, 'a PR or issue reference (PR numbers go in prs)'],
  [/[\r\n]/, 'a line break'],
];

/** The heading a month's notes carry: "2026-09" gives "September 2026". */
export function monthTitle(month: string): string {
  const [year, number] = month.split('-');
  return `${MONTH_NAMES[Number(number) - 1]} ${year}`;
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

function isInAppPath(value: unknown): boolean {
  return typeof value === 'string' && IN_APP_PATH.test(value);
}

function linkProblems(field: Field): string[] {
  const link = field.value;
  if (!isRecord(link) || Object.keys(link).sort().join() !== 'label,to') {
    return [`${field.path}: must be an object with exactly label and to`];
  }
  const to = isInAppPath(link.to)
    ? []
    : [`${field.path}.to: must be an in-app path (one leading /, no spaces or backslashes)`];
  return [...textProblems(field, LINK_LABEL), ...to];
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
  const inRange = count >= HIGHLIGHTS.min && count <= HIGHLIGHTS.max;
  if (items.length === 0 || inRange) return [];
  return [`highlights: ${count} items are marked, mark ${HIGHLIGHTS.min} to ${HIGHLIGHTS.max}`];
}

function monthProblems(notes: Record<string, unknown>): string[] {
  const {month, title} = notes;
  if (typeof month !== 'string' || !MONTH_PATTERN.test(month)) return ['month: must be YYYY-MM'];
  const expected = monthTitle(month);
  return title === expected ? [] : [`title: should be "${expected}" for ${month}`];
}

/** Everything wrong with a release notes file, one line each; empty when the file is valid. */
export function releaseNotesProblems(value: unknown): string[] {
  if (!isRecord(value)) return ['the file must hold one JSON object'];
  const root: Field = {path: '', value};
  return [
    ...unknownKeyProblems(root, MONTH_KEYS),
    ...(value.schemaVersion === 1 ? [] : ['schemaVersion: must be 1']),
    ...monthProblems(value),
    ...MONTH_TEXT.flatMap((rule) => textProblems(root, rule)),
    ...sectionsProblems(child(root, 'sections')),
    ...highlightProblems(value.sections),
  ];
}
