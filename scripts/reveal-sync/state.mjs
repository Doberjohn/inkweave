/**
 * Run-to-run memory (scripts/reveal-sync/state.json): which cards the skill has seen and
 * what happened to each, so a deferred card keeps showing up in reports until it is ready.
 *
 * Keyed by the site's slug, the only key discovery has before it fetches a page. Identity
 * checks never use the slug: the collector number rides inside each entry.
 *
 *   written   final: the card is in previewCards.json
 *   skipped   final: not part of this set's reveal data
 *   gone      the slug left the site, usually because a translated name was replaced;
 *             fetched again if it ever reappears, so a truncated index cannot lose a card
 *   deferred  retried every run
 *   conflict  retried every run, and waiting on the owner
 */
export const RETRYABLE = new Set(['deferred', 'conflict']);

/** The section for one set, created on first use. Seasons never share a section. */
export function setSection(state, setCode) {
  state.sets[setCode] ??= {cards: {}};
  return state.sets[setCode];
}

/** Slugs to fetch this run: never seen, still retryable, or back on the site after leaving it. */
export function selectCandidates(siteSlugs, section) {
  return siteSlugs.filter((slug) => {
    const entry = section.cards[slug];
    return !entry || RETRYABLE.has(entry.status) || entry.status === 'gone';
  });
}

/**
 * A warning when the site lists fewer cards than it did on the last run. The index only
 * grows during a reveal season, so a smaller one usually means a page failed to load.
 */
export function shrinkWarning(section, total) {
  const previous = section.indexTotal;
  if (!previous || total >= previous) return null;
  return `warning: the site now lists ${total} cards, ${previous - total} fewer than the last run's ${previous}. A page may have failed to load; if so, discover again before going on.`;
}

/** Retire retryable entries whose slug is no longer on the site. Returns the retired slugs. */
export function markVanished(siteSlugs, section) {
  const onSite = new Set(siteSlugs);
  const retired = [];
  for (const [slug, entry] of Object.entries(section.cards)) {
    if (!RETRYABLE.has(entry.status) || onSite.has(slug)) continue;
    section.cards[slug] = {...entry, status: 'gone', reason: 'slug no longer on the site'};
    delete section.cards[slug].detail;
    retired.push(slug);
  }
  return retired;
}

/** Record this run's outcome for a card, keeping its first-seen date and known number. */
export function recordOutcome(section, slug, outcome, today) {
  const previous = section.cards[slug];
  const number = outcome.number ?? previous?.number;
  section.cards[slug] = {
    ...(number == null ? {} : {number}),
    status: outcome.status,
    ...(outcome.reason ? {reason: outcome.reason} : {}),
    ...(outcome.detail ? {detail: outcome.detail} : {}),
    firstSeen: previous?.firstSeen ?? today,
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

export function waitingDays(entry, today) {
  return Math.round((Date.parse(today) - Date.parse(entry.firstSeen)) / DAY_MS);
}

/** Stable JSON: sets and slugs sorted, so a run's diff shows only what changed. */
export function serializeState(state) {
  const sorted = (obj, fn) =>
    Object.fromEntries(
      Object.keys(obj)
        .sort()
        .map((k) => [k, fn(obj[k])]),
    );
  const sets = sorted(state.sets, ({cards, ...rest}) => ({
    ...rest,
    cards: sorted(cards, (entry) => entry),
  }));
  return `${JSON.stringify({sets}, null, 2)}\n`;
}
