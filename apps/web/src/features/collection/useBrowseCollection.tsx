import {Suspense, useEffect, useState, type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {SET_PARAM, SORT_PARAM} from '../../shared/hooks/useFilterParams';
import {lazyWithRetry} from '../../shared/lib/lazyWithRetry';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SignInDialog} from '../../shared/components/SignInDialog';
import {SET_NAMES, type BrowseSortOrder} from '../../shared/constants';
import {useSession} from '../../shared/contexts/SessionContext';
import {useCollection} from './CollectionContext';
import {WindowCopies} from './CollectionCopies';
import type {Finish} from './collectionParser';
import {useKeptCards} from './useKeptCards';
import {useCollectionCards, useCollectionPool} from './CollectionCardsContext';
import {useCollectionClick} from './useCollectionClick';
import {binderModalTarget, type ModalTarget} from './collectionModalTarget';
import {
  BINDER_PARAM,
  BINDER_SORT_OPTIONS,
  OWNED_PARAM,
  WHOLE_COLLECTION,
  binderRarities,
  binderSets,
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

/** Who is asking for collection mode, and what is known about them yet. */
interface BinderReader {
  sessionLoading: boolean;
  /** The account's copy has not answered yet (`useCollection().syncing`). */
  syncing: boolean;
  signedIn: boolean;
  hasCollection: boolean;
}

/** What a `?binder=` param gets (`binderMode`). */
interface BinderMode {
  /** Collection mode is on: the binder replaces the grid, loading while the reader is not known yet. */
  active: boolean;
  /** The mode cannot be had, so the page drops the param. */
  dead: boolean;
  /**
   * The page drops the params the URL's mode never keeps (`strayParams`): always in the
   * grid, and under `?binder=` only once the param is known to be honoured.
   */
  dropsStrays: boolean;
}

/**
 * Whether `?binder=` gets collection mode, whether the param is dead, and whether the
 * page drops the URL's strays.
 *
 * The param asks for the mode; it is HONOURED only for someone the Collection button
 * would toggle for (signed in, holding a collection), so a shared link never shows a
 * stranger an empty binder in place of the grid. While the answer is not known yet (the
 * session still restoring, or the account's copy not yet heard from, which on a new
 * browser IS the collection), the binder is kept, loading, rather than flashing the
 * grid for a returning owner.
 *
 * Once a signed-in account has answered with no collection, the mode cannot be had, so
 * the param is DEAD and the page drops it. Left in, it reloaded into a loading binder; a
 * click that waited on the account leaves one behind (#553).
 *
 * `strayParams` reads the param, not the mode, so the page drops its strays only once the
 * param is known to be honoured (#790). Signed out, `?binder=` keeps the grid, and the
 * grid keeps a Set filter picked on it. Nor does the filter go while a stored session
 * restores: that reader may yet turn out signed out, or holding no collection.
 */
function binderMode(requested: string | null, reader: BinderReader): BinderMode {
  if (requested === null) return {active: false, dead: false, dropsStrays: true};
  const pending = reader.sessionLoading || reader.syncing;
  const honoured = !pending && reader.signedIn && reader.hasCollection;
  const active = pending || honoured;
  return {active, dead: reader.signedIn && !active, dropsStrays: honoured};
}

/**
 * Collection mode's params: `?binder=` (the mode and its set) and `?owned=` (what the
 * binder shows), and what the reader gets of the mode (`binderMode`). Every write edits
 * the params rather than replacing them, so the page's filters ride along. It starts
 * from the params as this hook last RENDERED them: react-router 7 hands the updater a
 * copy of its render-time snapshot, not the live URL. So a write here and one through
 * another hook (useFilterParams) in the same tick can still lose one of the two; keep
 * each user action to one writer.
 *
 * THE SET IS CHOSEN IN THE COLLECTION PANEL (owner, 2026-10-12), so collection mode
 * keeps no set FILTER: entering it opens the set a Browse set filter names (the newest,
 * if several) and drops the filter, and a link that carries one into the mode loses it.
 * Leaving drops the binder view, which the grid has no collection for; a link that
 * carries one outside the mode loses it too. See `strayParams`.
 */
export function useBinderParams(reader: BinderReader) {
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
  const mode = binderMode(requested, reader);
  const hasStrays = mode.dropsStrays && strayParams(searchParams).length > 0;
  useEffect(() => {
    if (!hasStrays) return;
    setSearchParams(withoutStrays, {replace: true});
  }, [hasStrays, setSearchParams]);

  return {
    requested,
    mode,
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
  /**
   * The cards changed by hand in the binder's current view, which its Owned and Missing views
   * keep (#826, `useKeptCards`): a first copy leaves a card where it was in Missing.
   */
  kept: ReadonlySet<string>;
  /** The sign-in and import dialogs, and the card window's "Your copies" (#826), a portal. */
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
  const {user, loading: sessionLoading} = useSession();
  const {entries, hasCollection, syncing, importCollection, setCount} = useCollection();
  const {retry} = useCollectionCards();
  const {requested, mode, show, enterBinder, writeBinder, leaveBinder, writeShow} = useBinderParams({
    sessionLoading,
    syncing,
    signedIn: user !== null,
    hasCollection,
  });

  const {active: collectionMode, dead} = mode;
  useEffect(() => {
    if (dead) leaveBinder();
  }, [dead, leaveBinder]);

  // Only collection mode (or the import, which parses against the full pool)
  // widens the pool, so a visitor who never switches fetches no chunks at all.
  const {pool, waiting, error, isReady} = useCollectionPool(coreCards, collectionMode || showImport);
  const sets = isReady ? binderSets(pool) : null;
  const setCode = resolveSetCode(requested, sets);

  // The cards changed by hand in this view of the binder, which its Owned and Missing views
  // keep: a view is the mode, the set, Owned or Missing, and the sort (`useKeptCards`).
  const [searchParams] = useSearchParams();
  const {kept, keep} = useKeptCards([collectionMode, setCode, show, searchParams.get(SORT_PARAM)].join('|'));
  const changeCount = (cardId: string, finish: Finish, count: number) => {
    setCount(cardId, finish, count);
    keep(cardId);
  };

  // Sign-in first, then import, then toggle; the order is the rule and lives in
  // `collectionAction`, pure and tested, since two branches need a real session.
  // `useCollectionClick` adds the wait for an account that has not answered yet.
  const openImport = () => {
    setImportMounted(true);
    setShowImport(true);
  };
  const onCollectionClick = useCollectionClick(
    {signedIn: user !== null, hasCollection, syncing, active: collectionMode},
    {openSignIn: () => setShowSignIn(true), openImport, enter: () => enterBinder(setCode, sets), leave: leaveBinder},
  );

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
          waiting={waiting}
          // Built here, not by the page: in grid mode a Set of up to 3,242 ids
          // would be rebuilt on every render for nobody.
          matchedIds={new Set(listing.cards.map((card) => card.id))}
          counted={listing.matched}
          filtered={listing.filtered}
          sortOrder={listing.sortOrder}
          entries={entries}
          // Loading while the account's copy is still to answer, too.
          isLoading={syncing || (!isReady && error === null)}
          error={error}
          onRetry={retry}
          {...panelControls}
          onCardSelect={onCardSelect}
          onCountChange={changeCount}
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
      <WindowCopies onEdit={keep} />
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
    kept,
    prompts,
    renderSetPanel: (listing) =>
      collectionMode ? (
        <Suspense fallback={null}>
          <DockedSetBody
            cards={listing.matched}
            filtered={listing.filtered}
            entries={entries}
            isLoading={syncing || !isReady}
            {...panelControls}
          />
        </Suspense>
      ) : undefined,
  };
}
