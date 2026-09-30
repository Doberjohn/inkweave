/**
 * The homepage's featured cards as a small file (#641), so `/` renders them without fetching the
 * whole card database. precompute-synergies.mjs writes it to apps/web/public/data/featuredCards.json.
 */

/**
 * VITE_FEATURED_CARD_IDS as Vite resolves it for the app, so the file holds the IDs the app asks
 * for: a value already in the environment wins (Vercel's build, a shell export), then
 * apps/web/.env.local, then apps/web/.env. The web app has no mode-specific env files.
 *
 * @param {Record<string, string | undefined>} env - process.env
 * @param {(name: string) => string | null} readEnvFile - an apps/web env file's text, or null
 * @returns {string | undefined}
 */
export function featuredIdsSetting(env, readEnvFile) {
  if (env.VITE_FEATURED_CARD_IDS !== undefined) return env.VITE_FEATURED_CARD_IDS;
  for (const name of ['.env.local', '.env']) {
    const match = readEnvFile(name)?.match(/^\s*VITE_FEATURED_CARD_IDS\s*=\s*(.*?)\s*$/m);
    if (match) return match[1].replace(/^(['"])(.*)\1$/, '$2');
  }
  return undefined;
}

/**
 * The featured IDs: the setting when it lists any, else the defaults from
 * apps/web/src/features/cards/featuredCardIds.json. Keep in step with resolveFeaturedIds in
 * apps/web/src/features/cards/featured.ts. If the file still misses an ID the app wants, the app
 * falls back to the full card list: slower, never wrong.
 *
 * @param {string | undefined} raw - comma-separated IDs
 * @param {string[]} defaults
 * @returns {string[]}
 */
export function resolveFeaturedIds(raw, defaults) {
  const parsed = (raw ?? '')
    .split(',')
    .map((id) => id.trim())
    .filter(Boolean);
  return parsed.length > 0 ? parsed : defaults;
}

/**
 * The featured cards in allCards.json's own shape, so the app runs them through the same
 * loadCardsFromJSON. Cards come from allCards.json or previewCards.json (allCards.json wins on
 * an id conflict, as in the app's loader), stay whole, and keep the display order; `sets` keeps
 * only the sets they belong to. Cards below the Core floor are dropped, as the app drops them.
 *
 * @param {{main: object, preview: object | null, ids: string[], isCoreSet: (setCode: string) => boolean}} input
 * @returns {{metadata: object, sets: Record<string, object>, cards: object[]}}
 */
export function buildFeaturedCards({main, preview, ids, isCoreSet}) {
  const byId = new Map();
  for (const card of preview?.cards ?? []) byId.set(String(card.id), card);
  for (const card of main.cards) byId.set(String(card.id), card);

  const cards = ids.map((id) => byId.get(id)).filter((card) => card && isCoreSet(card.setCode));
  const setCodes = new Set(cards.map((card) => card.setCode));
  const allSets = {...(preview?.sets ?? {}), ...(main.sets ?? {})};
  const sets = Object.fromEntries(Object.entries(allSets).filter(([code]) => setCodes.has(code)));

  return {metadata: main.metadata, sets, cards};
}
