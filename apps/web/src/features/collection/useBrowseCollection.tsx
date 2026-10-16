import {Suspense, useEffect, useState, type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {SET_PARAM} from '../../shared/hooks/useFilterParams';
import {lazyWithRetry} from '../../shared/lib/lazyWithRetry';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SignInDialog} from '../../shared/components/SignInDialog';
import {SET_NAMES, type BrowseSortOrder} from '../../shared/constants';
import {useSession} from '../../shared/contexts/SessionContext';
import {useCollection} from './CollectionContext';
import {useCollectionCards, useCollectionPool} from './CollectionCardsContext';
import {collectionAction} from './collectionAction';
import {binderModalTarget, type ModalTarget} from './collectionModalTarget';
import {
  BINDER_PARAM,
  BINDER_SORT_OPTIONS,
  OWNED_PARAM,
  WHOLE_COLLECTION,
  binderRarities,
  isBinderCard,
  parseBinderShow,
  setFromFilter,
  strayParams,
  withoutStrays,
  type BinderShow,
} from './binderCards';
import {CollectionModeSwitch} from './CollectionModeSwitch';

/*
 * The collection UI is SPLIT FROM BROWSE (#553 Phase C). The binder and the
 * import dialog (with the CSV parser behind it) load only when collection mode or
 * the dialog actually opens, so Browse's own chunk, the app's main route, does not
 * grow by a feature most visitors never switch on. The binder's own loading branch
 * draws its skeleton once its chunk is in; the brief wait for the chunk itself
 * shows nothing, and a dialog has nothing to hold space for. Each loads through
 * `lazyWithRetry`, like every lazy chunk in the app, so a tab left open across a
 * deploy retries a stale chunk rather than failing to the error page.
 */
const CollectionBinderSection = lazyWithRetry(
  () => import('./CollectionBinderSection'),
  'CollectionBinderSection',
);
// Same module as the binder, so the same chunk: the docked set panel costs no request of its own.
const DockedSetBody = lazyWithRetry(() => import('./CollectionBinderSection'), 'DockedSetBody');
const ImportCollectionDialog = lazyWithRetry(
  () => import('./ImportCollectionDialog'),
  'ImportCollectionDialog',
);

/**
 * Where the binder opens: the NEWEST set (owner, 2026-10-07), the one a collector
 * is most likely filling. Taken from `SET_NAMES` rather than the pool because the
 * first click on Collection comes BEFORE the pool loads (the toggle is what loads
 * it), and a new set cannot ship without its entry there (`SetCode` enforces it).
 */
const DEFAULT_SET = String(Math.max(...Object.keys(SET_NAMES).map(Number)));

/** Set codes with at least one binder card, newest first: the picker's order. */
function binderSets(pool: LorcanaCard[]): string[] {
  const codes = new Set<string>();
  for (const card of pool) if (card.setCode && isBinderCard(card)) codes.add(card.setCode);
  return [...codes].sort((a, b) => Number(b) - Number(a));
}

/**
 * The set to show, or the whole collection. A set the binder does not have
 * (`?binder=99`) falls back to the newest it does, rather than drawing an empty
 * binder under a picker naming a different set. Until the list is known the
 * request is trusted: nothing contradicts it yet.
 */
function resolveSetCode(requested: string | null, sets: string[] | null): string {
  if (requested === WHOLE_COLLECTION) return requested;
  const fallback = sets?.[0] ?? DEFAULT_SET;
  if (requested === null) return fallback;
  if (sets === null || sets.includes(requested)) return requested;
  return fallback;
}

/**
 * The panel's list of sets: the real one once known, else just the current set, so the
 * panel's height never changes when the list arrives; none for the whole collection.
 */
function panelSets(sets: string[] | null, setCode: string): string[] {
  if (sets !== null) return sets;
  return setCode === WHOLE_COLLECTION ? [] : [setCode];
}

/**
 * Collection mode's params: `?binder=` (the mode and its set) and `?owned=` (what the
 * binder shows). Every write edits the params rather than replacing them, so the page's
 * filters ride along. It starts from the params as this hook last RENDERED them:
 * react-router 7 hands the updater a copy of its render-time snapshot, not the live URL.
 * So a write here and one through another hook (useFilterParams) in the same tick can
 * still lose one of the two; keep each user action to one writer.
 *
 * THE SET IS CHOSEN IN THE COLLECTION PANEL (owner, 2026-10-12), so collection mode
 * keeps no set FILTER: entering it opens the set a Browse set filter names (the newest,
 * if several) and drops the filter, and a link that carries one into the mode loses it.
 * Leaving drops the binder view, which the grid has no collection for; a link that
 * carries one outside the mode loses it too. See `strayParams`.
 */
function useBinderParams() {
  const [searchParams, setSearchParams] = useSearchParams();
  function rewrite(change: (next: URLSearchParams) => void) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        change(next);
        return next;
      },
      {replace: true},
    );
  }
  const requested = searchParams.get(BINDER_PARAM);
  const hasStrays = strayParams(searchParams).length > 0;
  useEffect(() => {
    if (!hasStrays) return;
    setSearchParams(withoutStrays, {replace: true});
  }, [hasStrays, setSearchParams]);

  return {
    requested,
    show: parseBinderShow(searchParams.get(OWNED_PARAM)),
    enterBinder: (fallback: string, sets: string[] | null) =>
      rewrite((next) => {
        next.set(BINDER_PARAM, setFromFilter(next.get(SET_PARAM), sets) ?? fallback);
        next.delete(SET_PARAM);
      }),
    writeBinder: (set: string) => rewrite((next) => next.set(BINDER_PARAM, set)),
    // Out of the mode, the binder's view is a stray: gone in the same write.
    leaveBinder: () =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete(BINDER_PARAM);
          return withoutStrays(next);
        },
        {replace: true},
      ),
    writeShow: (show: BinderShow) =>
      rewrite((next) => (show === 'all' ? next.delete(OWNED_PARAM) : next.set(OWNED_PARAM, show))),
  };
}

/**
 * What Browse lists: the cards its filters let through, in its sort, and that sort.
 * The binder lights the cards and fills its pockets in the sort's order.
 */
export interface BrowseListing {
  cards: LorcanaCard[];
  sortOrder: BrowseSortOrder;
  /**
   * Every card the filters and search let through, before the binder's Owned / Missing
   * view: what the collection panel counts (owner, 2026-10-15).
   */
  matched: LorcanaCard[];
  /** Whether any filter or a search is on, so the panel says its numbers are filtered. */
  filtered: boolean;
}

/** What collection mode adds to Browse. `null` from the page when the flag is off. */
export interface BrowseCollectionSlots {
  /** True while collection mode is on: the binder replaces the grid. */
  active: boolean;
  /** The pool to filter: Core alone, or Core plus the collection once the mode is on. */
  pool: LorcanaCard[];
  /** The toolbar's mode control: the Collection toggle. */
  modeSwitch: ReactNode;
  /** Collection mode's content for the page's listing, or null to keep the grid. */
  renderBinder: (listing: BrowseListing, onCardSelect: (card: LorcanaCard) => void) => ReactNode | null;
  /**
   * How the card modal should open a clicked card, or null to open it as usual.
   * Set while the binder shows, because only it holds cards `CardDataContext` cannot
   * resolve. See `collectionModalTarget`. The modal's arrows walk the binder's lit
   * cards in the binder's order, not the page's list (see `binderModalTarget`).
   */
  modalTarget: ((cardId: string, listing: BrowseListing) => ModalTarget) | null;
  /** The sort's options while the binder shows (its default named for a binder), else undefined. */
  sortOptions: typeof BINDER_SORT_OPTIONS | undefined;
  /** What the binder shows, chosen in the collection panel: every card, the owned, or the missing. */
  show: BinderShow;
  /**
   * The binder's Rarity options, whose printings are pockets of their own (`binderRarities`).
   * Handed to the page rather than imported by it: `browseView` runs with the flag off too,
   * and a static import from here put the collection's data layer on Browse for everyone.
   */
  rarityOptions: (pool: LorcanaCard[]) => string[];
  /** Whether you hold a copy of the card, either finish: what Owned and Missing ask. */
  owns: (cardId: string) => boolean;
  /** The sign-in and import dialogs. */
  prompts: ReactNode;
  /**
   * The set panel's body for the page's listing while collection mode is on, else
   * undefined. Where the page docks panels (desktop) it renders this on the binder's
   * right, and the binder section then leaves its own set panel out. It takes the
   * listing because its numbers count the cards the filters let through.
   */
  renderSetPanel: (listing: BrowseListing) => ReactNode | undefined;
}

/**
 * Collection mode's state and controls for Browse, in one place so the page only
 * slots them in. Requires the collection providers, which the `CollectionScope`
 * layout route mounts only while `SHOW_COLLECTION` is on, so call it only behind
 * that flag.
 */
export function useBrowseCollection(coreCards: LorcanaCard[]): BrowseCollectionSlots {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Mounted from first open on, so closing plays DialogShell's exit instead of
  // unmounting mid-animation; never mounted at all for anyone who never opens it.
  const [importMounted, setImportMounted] = useState(false);
  const {requested, show, enterBinder, writeBinder, leaveBinder, writeShow} = useBinderParams();
  const {user, loading: sessionLoading} = useSession();
  const {entries, hasCollection, importCollection} = useCollection();
  const {retry} = useCollectionCards();

  // The param asks for the mode; it is HONOURED only for someone the Collection
  // button would toggle for (signed in, holding a collection), so a shared link
  // never shows a stranger an empty binder in place of the grid. While the session
  // is still restoring the answer is not known yet, so the binder is kept rather
  // than flashing the grid for a returning owner.
  const collectionMode = requested !== null && (sessionLoading || (user !== null && hasCollection));

  // Only collection mode (or the import, which parses against the full pool)
  // widens the pool, so a visitor who never switches fetches no chunks at all.
  const {pool, error, isReady} = useCollectionPool(coreCards, collectionMode || showImport);
  const sets = isReady ? binderSets(pool) : null;
  const setCode = resolveSetCode(requested, sets);

  // Sign-in first, then import, then toggle; the order is the rule and lives in
  // `collectionAction`, pure and tested, since two branches need a real session.
  function onCollectionClick() {
    const action = collectionAction({signedIn: user !== null, hasCollection});
    if (action === 'sign-in') return setShowSignIn(true);
    if (action === 'import') {
      setImportMounted(true);
      return setShowImport(true);
    }
    if (collectionMode) leaveBinder();
    else enterBinder(setCode, sets);
  }

  const modeSwitch = <CollectionModeSwitch active={collectionMode} onToggle={onCollectionClick} />;

  const panelControls = {
    setCode,
    sets: panelSets(sets, setCode),
    setsLoading: sets === null,
    onSetChange: writeBinder,
    show,
    onShowChange: writeShow,
  };

  function renderBinder(listing: BrowseListing, onCardSelect: (card: LorcanaCard) => void) {
    if (!collectionMode) return null;
    return (
      <Suspense fallback={null}>
        <CollectionBinderSection
          cards={pool}
          // Built here, not by the page: in grid mode a Set of up to 3,242 ids
          // would be rebuilt on every render for nobody.
          matchedIds={new Set(listing.cards.map((card) => card.id))}
          counted={listing.matched}
          filtered={listing.filtered}
          sortOrder={listing.sortOrder}
          entries={entries}
          isLoading={!isReady && error === null}
          error={error}
          onRetry={retry}
          {...panelControls}
          onCardSelect={onCardSelect}
        />
      </Suspense>
    );
  }

  const prompts = (
    <>
      <SignInDialog isOpen={showSignIn} onClose={() => setShowSignIn(false)} />
      {importMounted && (
        <Suspense fallback={null}>
          <ImportCollectionDialog
            isOpen={showImport}
            onClose={() => setShowImport(false)}
            pool={pool}
            // Blocks a parse against an incomplete pool: that parse does not fail,
            // it silently drops the cards it cannot see.
            isPoolReady={isReady}
            // Outside collection mode the binder, which shows this error too, is not drawn.
            poolError={error}
            onRetryPool={retry}
            // Land in collection mode on success: the reader pressed "Collection"
            // and was diverted through an import to get there. Only on success, or
            // a refused write would show an empty binder as if it had worked.
            onImport={(imported, at) => {
              const storageError = importCollection(imported, at);
              if (storageError === null) enterBinder(setCode, sets);
              return storageError;
            }}
          />
        </Suspense>
      )}
    </>
  );

  return {
    active: collectionMode,
    pool,
    modeSwitch,
    renderBinder,
    modalTarget: collectionMode
      ? (cardId, listing) => binderModalTarget(cardId, listing, {coreCards, pool, setCode, sets: panelControls.sets})
      : null,
    sortOptions: collectionMode ? BINDER_SORT_OPTIONS : undefined,
    show,
    rarityOptions: binderRarities,
    owns: (cardId) => {
      const held = entries[cardId];
      return held !== undefined && held.normal + held.foil > 0;
    },
    prompts,
    renderSetPanel: (listing) =>
      collectionMode ? (
        <Suspense fallback={null}>
          <DockedSetBody
            cards={listing.matched}
            filtered={listing.filtered}
            entries={entries}
            isLoading={!isReady}
            {...panelControls}
          />
        </Suspense>
      ) : undefined,
  };
}
