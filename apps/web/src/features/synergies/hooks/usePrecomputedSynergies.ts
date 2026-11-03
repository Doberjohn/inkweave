import {useSyncExternalStore} from 'react';
import type {
  LorcanaCard,
  SynergyGroup,
  SynergyMatchDisplay,
  PairSynergyConnection,
  DetailedPairSynergy,
} from 'inkweave-synergy-engine';
import {useCardDataContext} from '../../../shared/contexts/CardDataContext';
import {fillChipNames} from '../utils';

// ── Pre-computed JSON shapes (must match scripts/precompute-synergies.mjs output) ──

interface PrecomputedSynergyMatch {
  cardId: string;
  score: number;
  explanation: string;
  ruleId?: string;
  ruleName?: string;
}

interface PrecomputedSynergyGroup {
  groupKey: string;
  category: 'direct' | 'playstyle';
  label: string;
  tagline: string;
  description: string;
  synergies: PrecomputedSynergyMatch[];
}

export interface PrecomputedPairData {
  connections: PairSynergyConnection[];
  aggregateScore: number;
}

interface PrecomputedCardData {
  groups: PrecomputedSynergyGroup[];
  pairs: Record<string, PrecomputedPairData>;
}

// ── One load per card, shared by every view of it ──

/**
 * A card's synergy file as the page holds it: kept once fetched (`data`), on its way (`request`,
 * which main.tsx's hold (#915) and the card page share), or failed. A failure stays only while
 * some view shows the card (`usePrecomputedSynergies`): the card page and a window over it, or a
 * compare link's page and its window, then share one failure and one Try again rather than each
 * fetching the file. It goes with the last of them, so a later look at the card fetches again.
 */
interface CardLoadEntry {
  readonly id: string;
  data?: PrecomputedCardData;
  request?: Promise<PrecomputedCardData>;
  failure?: Error;
  /** The views showing the card, told when its load changes. */
  readonly views: Set<() => void>;
  /**
   * Adds a view, fetching the file unless it is kept, on its way or failed for a view already
   * showing it. One per card, so `useSyncExternalStore` keeps a view's subscription across
   * renders: a fresh one each render would leave and rejoin, and the leave could drop the
   * failure the view shows.
   */
  readonly watch: (onChange: () => void) => () => void;
  /** `data`'s groups resolved against the card list that resolved them, for every render. */
  resolved?: {data: PrecomputedCardData; getCardById: CardLookup; groups: SynergyGroup[]};
}

type CardLookup = (id: string) => LorcanaCard | undefined;

const cardLoads = new Map<string, CardLoadEntry>();

function cardLoadEntry(cardId: string): CardLoadEntry {
  const kept = cardLoads.get(cardId);
  if (kept) return kept;
  const views = new Set<() => void>();
  const entry: CardLoadEntry = {
    id: cardId,
    views,
    watch: (onChange) => {
      views.add(onChange);
      if (!entry.data && !entry.failure) requestSynergies(entry).catch(() => undefined);
      return () => {
        views.delete(onChange);
        if (views.size === 0) entry.failure = undefined;
      };
    },
  };
  cardLoads.set(cardId, entry);
  return entry;
}

function tellViews(entry: CardLoadEntry): void {
  entry.views.forEach((onChange) => onChange());
}

/** Keeps a card's file for the page, and tells its views, whichever caller fetched it. */
function rememberSynergies(entry: CardLoadEntry, data: PrecomputedCardData): PrecomputedCardData {
  entry.data = data;
  entry.failure = undefined;
  tellViews(entry);
  return data;
}

/** A failure only views showing the card keep: a preload's or main.tsx's hold's is forgotten. */
function rememberFailure(entry: CardLoadEntry, error: unknown): void {
  if (entry.views.size === 0) return;
  console.error(`Failed to load synergies for card ${entry.id}:`, error);
  entry.failure = error instanceof Error ? error : new Error(String(error));
  tellViews(entry);
}

/**
 * A card's synergy file, fetched once for the page. A card with no file (a 404, or the dev
 * server's page in its place) reads as none, and that answer is kept for the page. Any other
 * failure (offline, an error status, a body that won't parse) throws, and only the views showing
 * the card keep it, so the next look fetches again: a passing 5xx never leaves a card reading as
 * none for the visit.
 */
export function fetchCardSynergies(cardId: string): Promise<PrecomputedCardData> {
  return requestSynergies(cardLoadEntry(cardId));
}

function requestSynergies(entry: CardLoadEntry): Promise<PrecomputedCardData> {
  if (entry.data) return Promise.resolve(entry.data);
  entry.request ??= loadCardSynergies(entry)
    .catch((error: unknown) => {
      rememberFailure(entry, error);
      throw error;
    })
    .finally(() => {
      entry.request = undefined;
    });
  return entry.request;
}

async function loadCardSynergies(entry: CardLoadEntry): Promise<PrecomputedCardData> {
  const response = await fetch(`/data/synergies/${entry.id}.json`);
  // Card has no synergies (not in manifest). Cache the empty result.
  if (response.status === 404) return rememberSynergies(entry, {groups: [], pairs: {}});
  if (!response.ok) throw new Error(`Synergy file for card ${entry.id} answered ${response.status}`);

  // Guard against SPA fallback: Vite dev server returns 200 + HTML for missing files
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return rememberSynergies(entry, {groups: [], pairs: {}});

  const data: PrecomputedCardData = await response.json();
  return rememberSynergies(entry, data);
}

/** Fetches a card's file again for every view showing it, after a failure. */
function retrySynergies(entry: CardLoadEntry): void {
  entry.failure = undefined;
  tellViews(entry);
  requestSynergies(entry).catch(() => undefined);
}

const LOADING = 'loading';
const NO_CARD = 'no-card';
type CardLoad = PrecomputedCardData | Error | typeof LOADING | typeof NO_CARD;

/** A card's load as its views read it: its file wins over an earlier failure. */
function readLoad(entry: CardLoadEntry | undefined): CardLoad {
  if (!entry) return NO_CARD;
  return entry.data ?? entry.failure ?? LOADING;
}

const watchNothing = () => () => undefined;

// ── Pure helpers ──

/**
 * Group-scoped pair filter (Option A calibration).
 *
 * When `groupKey` is undefined, returns the pair unchanged. When provided, keeps only
 * connections that belong to that group — direct rules are their own group (`ruleId`),
 * playstyle rules merge by `playstyleId` — and recomputes `aggregateScore` from the
 * filtered set. Returns null if no connections match.
 */
export function filterPairByGroup(
  pairData: PrecomputedPairData,
  groupKey?: string,
): {connections: PairSynergyConnection[]; aggregateScore: number} | null {
  if (!groupKey) {
    return {connections: pairData.connections, aggregateScore: pairData.aggregateScore};
  }
  const filtered = pairData.connections.filter((c) =>
    c.category === 'playstyle' ? c.playstyleId === groupKey : c.ruleId === groupKey,
  );
  if (filtered.length === 0) return null;
  return {
    connections: filtered,
    aggregateScore: Math.max(...filtered.map((c) => c.score)),
  };
}

// ── Resolve pre-computed data into full types ──

/**
 * The groups with their partner cards. A tile shows its explanation only as plain text (the
 * strength badge's tooltip), so its {A}/{B} chip tokens become the two cards' names; the pair
 * view reads the tokens from `pairs`, which stay as they are.
 */
function resolveGroups(
  precomputed: PrecomputedSynergyGroup[],
  getCardById: CardLookup,
  source: LorcanaCard | undefined,
): SynergyGroup[] {
  return precomputed
    .map((group) => ({
      groupKey: group.groupKey,
      category: group.category,
      label: group.label,
      tagline: group.tagline,
      description: group.description,
      synergies: group.synergies
        .map((match): SynergyMatchDisplay | null => {
          const card = getCardById(match.cardId);
          if (!card) return null;
          return {
            card,
            score: match.score,
            explanation: source
              ? fillChipNames(match.explanation, source, card)
              : match.explanation,
            ruleId: match.ruleId,
            ruleName: match.ruleName,
          };
        })
        .filter((s): s is SynergyMatchDisplay => s !== null),
    }))
    .filter((g) => g.synergies.length > 0);
}

export interface UsePrecomputedSynergiesReturn {
  synergies: SynergyGroup[];
  isLoading: boolean;
  /** Why the card's file failed to load (not a 404, which reads as no synergies), or null. */
  error: Error | null;
  /** Fetches the card's file again: set only while its last fetch failed. */
  retry: (() => void) | undefined;
  getPairSynergies: (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null;
}

const NO_SYNERGIES: SynergyGroup[] = [];
const NO_PAIR = () => null;

/** `data`'s groups, resolved once per file and card list so each render hands back the same. */
function groupsFor(entry: CardLoadEntry, data: PrecomputedCardData, getCardById: CardLookup): SynergyGroup[] {
  const kept = entry.resolved;
  if (kept?.data === data && kept.getCardById === getCardById) return kept.groups;
  const groups = resolveGroups(data.groups, getCardById, getCardById(entry.id));
  entry.resolved = {data, getCardById, groups};
  return groups;
}

/** What a view of `selectedCard` returns for the load it reads. */
function viewOf(
  load: CardLoad,
  entry: CardLoadEntry | undefined,
  selectedCard: LorcanaCard | null,
  getCardById: CardLookup,
): UsePrecomputedSynergiesReturn {
  const unsettled = {synergies: NO_SYNERGIES, isLoading: load === LOADING, error: null, retry: undefined};
  if (!entry || typeof load === 'string') return {...unsettled, getPairSynergies: NO_PAIR};
  if (load instanceof Error) {
    return {...unsettled, error: load, retry: () => retrySynergies(entry), getPairSynergies: NO_PAIR};
  }
  return {
    ...unsettled,
    synergies: groupsFor(entry, load, getCardById),
    getPairSynergies: buildPairResolver(selectedCard, load.pairs),
  };
}

/**
 * Fetches pre-computed synergies for a card.
 * Replaces client-side engine calls with pre-computed JSON fetches.
 * `isLoading` is true from the first render with a card until its fetch settles, and again
 * through a `retry`. A file the page has fetched already, such as the one main.tsx's hold waited
 * for (#915), settles the first render; the card page keeps its footer out until this settles
 * (#532). Every view of a card reads one load (`CardLoadEntry`), so a retry from one reloads them
 * all, and a file another caller fetches replaces a failure.
 */
export function usePrecomputedSynergies(
  selectedCard: LorcanaCard | null,
): UsePrecomputedSynergiesReturn {
  const {getCardById} = useCardDataContext();
  const entry = selectedCard ? cardLoadEntry(selectedCard.id) : undefined;
  const load = useSyncExternalStore(entry?.watch ?? watchNothing, () => readLoad(entry));
  return viewOf(load, entry, selectedCard, getCardById);
}

/**
 * Closes over the currently-selected card and its loaded pair data, returning a resolver that
 * looks up a clicked-card → pair synergy. Extracted to keep `usePrecomputedSynergies`'s
 * cyclomatic complexity under threshold (the hook orchestrates fetch + state, the resolver
 * handles its own null/filter branches).
 */
function buildPairResolver(
  selectedCard: LorcanaCard | null,
  pairs: Record<string, PrecomputedPairData>,
): (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null {
  return (clickedCard, groupKey) => {
    if (!selectedCard) return null;
    const pairData = pairs[clickedCard.id];
    if (!pairData) return null;
    const filtered = filterPairByGroup(pairData, groupKey);
    if (!filtered) return null;
    return {cardA: selectedCard, cardB: clickedCard, ...filtered};
  };
}

