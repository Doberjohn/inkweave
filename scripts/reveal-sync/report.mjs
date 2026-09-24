/**
 * The run report: the one thing the owner reads. Pure formatting over a run record and the
 * state section, so it can be tested without a browser or a repo.
 */
import {waitingDays} from './state.mjs';

const REASONS = {
  'not-officially-revealed': (d) => `not officially revealed (${d})`,
  'official-mismatch': (d) => `the two sites disagree: ${d}`,
  'official-image-missing': (d) => `official scan not found: ${d}`,
  'official-entry-unreadable': (d) => `${d}; check it on the site by hand`,
  'scan-not-english': (d) => `scan not in English (${d})`,
  'language-unknown': () => 'scan language unknown',
  'site-record-incomplete': (d) => `site record incomplete: ${d}`,
  'needs-reserved-band': (d) =>
    `${d ?? 'no readable collector number'}: needs a reserved-band id, added by hand`,
  'fetch-failed': (d) => `fetch failed: ${d}`,
  'page-unreadable': (d) => `page unreadable: ${d}`,
  'validation-failed': (d) => `rejected before writing: ${d}`,
  'art-failed': (d) => `art conversion failed: ${d}`,
};

const quote = (value) =>
  value == null ? 'unreadable' : JSON.stringify(Array.isArray(value) ? value.join(' / ') : value);

/** One disputed field: lorcanaplayer's value ("site"), the official list's, and the readers'. */
function describeConflict({field, site, official, readers}) {
  const parts = [`${field}: site ${quote(site)}`];
  if (official !== undefined) parts.push(`official ${quote(official)}`);
  if (readers) parts.push(`readers ${readers.map(quote).join(', ')}`);
  return parts.join('; ');
}

function reasonText(card) {
  if (card.conflicts?.length) return card.conflicts.map(describeConflict).join('; ');
  if (card.status === 'reading') return `${card.jobs?.length ?? 0} reader job(s) assigned`;
  const format = REASONS[card.reason];
  return format ? format(card.detail) : (card.detail ?? card.reason ?? '');
}

const pad = (s, n) => String(s).padEnd(n);
const label = (card) => (card.number == null ? '--' : `#${card.number}`);
const row = (tag, name, detail) => `  ${pad(tag, 7)}${pad(name, 46)}${detail}`;

function writtenRow(slug, card) {
  const ink = card.card.inks.join('-');
  const lines = [row(card.id ?? label(card), card.title, `${pad(ink, 18)}${card.card.rarity}`)];
  for (const note of card.notes ?? []) lines.push(`         note: ${note}`);
  return lines;
}

/** Waiting time before the reason, so a long reason never runs into it. */
function waitingRow(slug, card, entry, today) {
  const days = entry ? waitingDays(entry, today) : 0;
  const waited = `waiting ${days} day${days === 1 ? '' : 's'}`;
  return [row(label(card), card.title ?? slug, `${pad(waited, 17)}${reasonText(card)}`)];
}

function plainRow(slug, card) {
  return [row(label(card), card.title ?? slug, reasonText(card))];
}

const SECTIONS = [
  {
    heading: (phase) => (phase === 'written' ? 'WRITTEN' : 'READY TO WRITE'),
    statuses: ['written', 'ready'],
    row: writtenRow,
  },
  {heading: () => 'NEEDS YOUR CALL', statuses: ['conflict'], row: plainRow},
  {heading: () => 'DEFERRED', statuses: ['deferred'], row: waitingRow},
  {heading: () => 'STILL READING', statuses: ['reading'], row: plainRow},
  {heading: () => 'ERRORS', statuses: ['error'], row: plainRow},
  {heading: () => 'SKIPPED', statuses: ['skipped'], row: plainRow},
];

/** The official list under the header: how many main-set cards it shows, how fresh it is, what was set aside. */
export function officialLines(run) {
  const official = run.official;
  if (!official) return [];
  const lines = [
    `Official list: ${official.revealed} revealed in #1-${run.season.setTotal} (illumineertales.com, last modified ${official.lastModified}).`,
  ];
  if (official.malformed?.length)
    lines.push(`Set aside as unreadable: ${official.malformed.join(', ')}`);
  return lines;
}

/** This set's Inkweave cards the official list does not show as revealed, or names differently. Never changed by a run. */
export function auditLines(run) {
  if (!run.audit?.length) return [];
  return [
    '',
    `ON INKWEAVE, CHECK AGAINST THE OFFICIAL LIST (${run.audit.length})`,
    ...run.audit.map((finding) => row(finding.id, finding.name, finding.problem)),
  ];
}

/** Official cards lorcanaplayer does not have yet, so none goes quietly missing. */
function waitingForSiteLines(run) {
  if (!run.waiting?.length) return [];
  return [
    '',
    `OFFICIAL, NOT ON LORCANAPLAYER YET (${run.waiting.length})`,
    ...run.waiting.map((w) =>
      row(`#${w.number}`, w.name, `revealed ${w.revealedOn} (${w.revealedBy})`),
    ),
  ];
}

/**
 * @param run      the run record (run.json)
 * @param section  this set's state section, for first-seen dates
 * @param today    YYYY-MM-DD
 */
export function formatReport(run, section, today) {
  const cards = Object.entries(run.cards);
  const phase = cards.some(([, c]) => c.status === 'written') ? 'written' : 'pending';
  const known = cards.filter(([, c]) => c.status === 'known').length;
  const lines = [
    `/fetch-reveals  Set ${run.season.setCode} (${run.season.setName})  run ${run.runId}`,
    ...officialLines(run),
    `Site: ${run.site?.total ?? '?'} cards on ${run.site?.pages?.length ?? '?'} pages. Checked this run: ${cards.length} (${known} already in Inkweave).`,
  ];
  for (const {heading, statuses, row: rowFor} of SECTIONS) {
    const group = cards
      .filter(([, c]) => statuses.includes(c.status))
      .sort(([, a], [, b]) => (a.number ?? 0) - (b.number ?? 0));
    if (!group.length) continue;
    lines.push('', `${heading(phase)} (${group.length})`);
    for (const [slug, card] of group) lines.push(...rowFor(slug, card, section.cards[slug], today));
  }
  lines.push(...auditLines(run), ...waitingForSiteLines(run));
  if (run.retired?.length)
    lines.push('', `No longer on the site, retired from waiting: ${run.retired.join(', ')}`);
  return lines.join('\n');
}
