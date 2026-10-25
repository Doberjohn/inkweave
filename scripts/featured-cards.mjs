/**
 * The homepage's featured cards as a small file (#641), so `/` renders them without fetching the
 * whole card database. precompute-synergies.mjs writes it to apps/web/public/data/featuredCards.json,
 * for the ids in apps/web/src/features/cards/featuredCardIds.json, the list's only source (#957).
 */

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
