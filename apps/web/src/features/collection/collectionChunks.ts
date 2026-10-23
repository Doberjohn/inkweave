// The collection dataset's files (#553), each loaded once per visit, in two stages (#911).
//
// Sets 1-8 and the promo catalog are what Browse's search needs: the cards Core doesn't
// have, and the promos among their printings. Sets 9-14 hold only Core cards' chase
// printings, as cards of their own, which allCards.json already carries as `variants`, so
// only collection mode's binder asks for them. A search and collection mode share the
// first stage's promise, so a visitor who does both downloads sets 1-8 once.
//
// MODULE STATE, not a provider's: Browse searches with no collection provider above it
// while `SHOW_COLLECTION` is off, and `CollectionScope` remounts between Browse and a card
// page. A failed stage is forgotten, so a later ask fetches again. Never ask from render,
// or from an effect whose deps change with the result: a forgotten failure would then
// refetch on every render, the loop `CollectionCardsContext` guards against.

import type {LorcanaCard, LorcanaJSONCard} from 'inkweave-synergy-engine';
import {transformRawCards} from '../cards/loader';
import {transformPromos, type CollectionPromo, type RawCollectionPromo} from './collectionPromos';
import {withPreCoreVariants} from './preCoreVariants';

/** Sets 1-8: the cards Core doesn't have, and their printings. */
const PRE_CORE_SETS = ['1', '2', '3', '4', '5', '6', '7', '8'];
/** Sets 9-14: Core cards' chase printings, as cards of their own. */
const CORE_SETS = ['9', '10', '11', '12', '13', '14'];

/**
 * Every set with a collection chunk. Ordered as a binder would be.
 *
 * MUST MATCH what `generate-collection-data.mjs` actually emits. Q1/Q2 were here
 * until the Quest sets were excluded from the dataset (owner ruling, 2026-10-06):
 * Illumineer's Quest is a separate co-op product, not trading-card boosters. The
 * stale entries were not harmless, because a missing chunk 404s, `Promise.all`
 * rejects, and collection mode gets an empty pool rather than a partial one.
 *
 * The two stages are listed rather than split with the engine's `isCoreSet`: importing it here
 * adds an export to the startup chunk, which reshuffles the short names many lazy chunks import
 * by (about 0.2 kB of JS in all, #911). collectionChunks.test.ts holds the lists to `isCoreSet`.
 */
export const COLLECTION_SETS = [...PRE_CORE_SETS, ...CORE_SETS];

async function fetchChunk(setCode: string): Promise<LorcanaCard[]> {
  const res = await fetch(`/data/collection/${setCode}.json`);
  if (!res.ok) throw new Error(`set ${setCode}: HTTP ${res.status}`);
  const cards = (await res.json()) as LorcanaJSONCard[];
  // The LOADER's transformer, not the engine's. The engine's deliberately leaves
  // `imageUrl` unset ("a web-app concern"), and the loader wraps it to attach the
  // resolved URL plus the content-addressed hashes. Calling the engine directly
  // costs every collection card its artwork: `CardTile` falls back to the plain
  // cost badge when `imgSrc` is falsy, which looks like 2,009 cards with no image
  // rather than a missing transform step.
  return transformRawCards(cards);
}

/**
 * The collection's promos (#805), beside the set chunks: every promo in the owner's catalog,
 * each built into a pocket from the card it reprints (`withPromoPockets`).
 */
async function fetchPromos(): Promise<CollectionPromo[]> {
  const res = await fetch('/data/collection/promos.json');
  if (!res.ok) throw new Error(`promos: HTTP ${res.status}`);
  return transformPromos((await res.json()) as RawCollectionPromo[]);
}

/** One load per visit, shared by every caller. A failure is forgotten, so a later call fetches again. */
function loadOnce<T>(load: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= load().catch((error: unknown) => {
      pending = null;
      throw error;
    });
    return pending;
  };
}

/** Sets 1-8 and the promo catalog, as their files hold them: a printing is a card of its own. */
interface PreCoreSets {
  cards: LorcanaCard[];
  promos: CollectionPromo[];
}

/** Sets 1-8 and the promo catalog: Browse's search needs them, and so does collection mode. */
export const loadPreCoreSets = loadOnce(async (): Promise<PreCoreSets> => {
  const [chunks, promos] = await Promise.all([Promise.all(PRE_CORE_SETS.map(fetchChunk)), fetchPromos()]);
  return {cards: chunks.flat(), promos};
});

/** Sets 9-14, which only collection mode's binder shows. */
export const loadCoreSetChunks = loadOnce(async () => (await Promise.all(CORE_SETS.map(fetchChunk))).flat());

/**
 * Browse's search cards from sets 1-8 (#911): each card with its printings in `variants`, as
 * the card window's printing switcher reads them (#891), and the printings themselves left out.
 */
export async function loadPreCoreSearchCards(): Promise<LorcanaCard[]> {
  const {cards, promos} = await loadPreCoreSets();
  return withPreCoreVariants(cards, promos).filter((card) => card.baseId === undefined);
}
