import type {Page} from '@playwright/test';

export interface RevealSet {
  name: string;
  number: number;
  releaseDate: string;
}

/** A set block is usable here only once it carries the three fields the specs read. */
function isRevealSet(set: Partial<RevealSet> | undefined): set is RevealSet {
  return (
    typeof set?.name === 'string' &&
    typeof set?.number === 'number' &&
    typeof set?.releaseDate === 'string'
  );
}

/**
 * The set in reveal season: the previewCards.json entry with the latest releaseDate. Read from
 * the data the app itself reads, so no spec names a set or needs an edit when a new season starts.
 */
function latestRevealSet(data: {
  sets?: Record<string, Partial<RevealSet> | undefined>;
}): RevealSet | null {
  const dated = Object.values(data?.sets ?? {}).filter(isRevealSet);
  if (dated.length === 0) return null;
  return dated.reduce((a, b) => (new Date(b.releaseDate) > new Date(a.releaseDate) ? b : a));
}

/** Noon two days before release day: inside the season even if the browser's time zone differs. */
const HOURS_BEFORE_RELEASE = 36;
const HOUR_MS = 3_600_000;

/**
 * Starts the page's clock inside the reveal season and returns the reveal set, or null (clock
 * untouched) when previewCards.json has no dated set. Call it before the first navigation.
 *
 * From release day on, useRevealPhase returns 'released': RevealsGate redirects /reveals to /,
 * and the Reveals nav entry and promo card stop rendering. On the real clock, the season's UI
 * would go untested from each set's release until the next set's dates land. Graduation keeps
 * the set's dates in previewCards.json and its cards in allCards.json, so the page still has its
 * data on the pinned date. The clock then runs at normal speed, so timers and Date.now() behave
 * as they would on a real visit.
 */
export async function startClockInRevealSeason(page: Page): Promise<RevealSet | null> {
  const response = await page.request.get('/data/previewCards.json');
  const set = response.ok() ? latestRevealSet(await response.json()) : null;
  if (!set) return null;
  // Local midnight, the boundary useRevealPhase uses (an ISO date-time without an offset is local).
  const releaseDay = new Date(`${set.releaseDate}T00:00:00`).getTime();
  await page.clock.install({time: releaseDay - HOURS_BEFORE_RELEASE * HOUR_MS});
  return set;
}
