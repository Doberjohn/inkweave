/**
 * The run report: the one thing the owner reads. Pure formatting over a run record and the
 * state section, so it can be tested without a browser or a repo.
 */
import {waitingDays} from './state.mjs';

const REASONS = {
  'scan-not-english': (d) => `scan not in English (${d})`,
  'language-unknown': () => 'scan language unknown',
  'site-record-incomplete': (d) => `site record incomplete: ${d}`,
  'needs-reserved-band': () =>
    'no readable collector number: needs a reserved-band id, added by hand',
  'fetch-failed': (d) => `fetch failed: ${d}`,
  'page-unreadable': (d) => `page unreadable: ${d}`,
  'image-missing': () => 'no card image on the page',
  'image-fetch-failed': (d) => `card image fetch failed: ${d}`,
  'image-unsupported': (d) => `card image not usable: ${d}`,
  'validation-failed': (d) => `rejected before writing: ${d}`,
  'art-failed': (d) => `art conversion failed: ${d}`,
};

const quote = (value) =>
  value == null ? 'unreadable' : JSON.stringify(Array.isArray(value) ? value.join(' / ') : value);

function describeConflict({field, site, readers}) {
  return `${field}: site ${quote(site)}; readers ${readers.map(quote).join(', ')}`;
}

function reasonText(card) {
  if (card.conflicts?.length) return card.conflicts.map(describeConflict).join('; ');
  if (card.status === 'reading') return `${card.jobs?.length ?? 0} reader job(s) assigned`;
  const format = REASONS[card.reason];
  return format ? format(card.detail) : (card.detail ?? card.reason ?? '');
}

const pad = (s, n) => String(s).padEnd(n);
const label = (card) => (card.number == null ? '--' : `#${card.number}`);

function writtenRow(slug, card) {
  const ink = card.card.inks.join('-');
  const lines = [
    `  ${pad(card.id ?? label(card), 7)}${pad(card.title, 46)}${pad(ink, 18)}${card.card.rarity}`,
  ];
  for (const note of card.notes ?? []) lines.push(`         note: ${note}`);
  return lines;
}

/** Waiting time before the reason, so a long reason never runs into it. */
function waitingRow(slug, card, entry, today) {
  const days = entry ? waitingDays(entry, today) : 0;
  const waited = `waiting ${days} day${days === 1 ? '' : 's'}`;
  return [
    `  ${pad(label(card), 7)}${pad(card.title ?? slug, 46)}${pad(waited, 17)}${reasonText(card)}`,
  ];
}

function plainRow(slug, card) {
  return [`  ${pad(label(card), 7)}${pad(card.title ?? slug, 46)}${reasonText(card)}`];
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
    `Site: ${run.site?.total ?? '?'} cards on ${run.site?.pages?.length ?? '?'} pages. Checked this run: ${cards.length} (${known} already in Inkweave).`,
  ];
  for (const {heading, statuses, row} of SECTIONS) {
    const group = cards
      .filter(([, c]) => statuses.includes(c.status))
      .sort(([, a], [, b]) => (a.number ?? 0) - (b.number ?? 0));
    if (!group.length) continue;
    lines.push('', `${heading(phase)} (${group.length})`);
    for (const [slug, card] of group) lines.push(...row(slug, card, section.cards[slug], today));
  }
  if (run.retired?.length)
    lines.push('', `No longer on the site, retired from waiting: ${run.retired.join(', ')}`);
  return lines.join('\n');
}
