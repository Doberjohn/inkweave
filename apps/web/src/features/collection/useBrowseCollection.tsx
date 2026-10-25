import {Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {useSearchParams} from 'react-router-dom';
import {SET_PARAM, SORT_PARAM} from '../../shared/hooks/useFilterParams';
import {trackEvent} from '../../shared/lib/analytics';
import {lazyWithRetry} from '../../shared/lib/lazyWithRetry';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SignInDialog} from '../../shared/components/SignInDialog';
import {SET_NAMES, type BrowseSortOrder} from '../../shared/constants';
import {useSession} from '../../shared/contexts/SessionContext';
import {useCollection} from './CollectionContext';
import type {Finish} from './collectionParser';
import {isHeld, type Axis} from './collectionStats';
import {useKeptCards} from './useKeptCards';
import {useCollectionCards, useCollectionPool} from './CollectionCardsContext';
import {useCollectionClick} from './useCollectionClick';
import {binderModalTarget, type ModalTarget} from './collectionModalTarget';
import {
  ALL_PROMO_SETS,
  BINDER_PARAM,
  BINDER_SORT_OPTIONS,
  OWNED_PARAM,
  WHOLE_COLLECTION,
  binderRarities,
  binderSets,
  isPromoScope,
  isPromoSet,
  parseBinderShow,
  rarityPicksPromos,
  setFromFilter,
  spansSets,
  strayParams,
  withoutStrays,
  writeShowParam,
  type BinderShow,
} from './binderCards';
import {CollectionModeSwitch} from './CollectionModeSwitch';
import {CollectionActions} from './CollectionActions';
import {WindowCopies} from './WindowCopies';
import {PhoneBinderRow} from './PhoneBinderRow';
import {BinderSheet, type BinderSheetProps} from './BinderSheet';
import {
  BinderChunkFallback,
  DockedSetBodyFallback,
  RowSetPickerFallback,
  SheetNumbersFallback,
  ToolbarSetPickerFallback,
} from './BinderChunkFallback';

/*
 * The collection UI is SPLIT FROM BROWSE (#553 Phase C). The binder and the
 * import dialog (with the CSV parser behind it) load only when collection mode or
 * the dialog actually opens, so Browse's own chunk, the app's main route, does not
 * grow by a feature most visitors never switch on. The binder's own loading branch
 * draws its skeleton once its chunk is in; while the chunk itself downloads, the
 * binder, the docked set panel, the set picker in the toolbar or a phone's row, and
 * the numbers in a phone's Binder sheet hold their places (`BinderChunkFallback`,
 * #913, #969), and each chunk is asked for on intent, before it is
 * needed: the binder's when a pointer or focus reaches Collection (`preloadBinder`),
 * the import dialog's when the collection's actions menu opens. A dialog has nothing
 * to hold space for. Each loads through `lazyWithRetry`, like every lazy chunk in the
 * app, so a tab left open across a deploy retries a stale chunk rather than failing
 * to the error page.
 */
const CollectionBinderSection = lazyWithRetry(
  () => import('./CollectionBinderSection'),
  'CollectionBinderSection',
);
// Same module as the binder, so the same chunk: the docked set panel costs no request of its own,
// nor do a phone row's set picker and its Binder sheet's numbers.
const DockedSetBody = lazyWithRetry(() => import('./CollectionBinderSection'), 'DockedSetBody');
const DockedSetPicker = lazyWithRetry(() => import('./CollectionBinderSection'), 'DockedSetPicker');
const PhoneSetPicker = lazyWithRetry(() => import('./CollectionBinderSection'), 'PhoneSetPicker');
const PhoneSetNumbers = lazyWithRetry(() => import('./CollectionBinderSection'), 'PhoneSetNumbers');
const ImportCollectionDialog = lazyWithRetry(
  () => import('./ImportCollectionDialog'),
  'ImportCollectionDialog',
);

/**
 * Starts the binder's chunk on intent (#913): one request for the binder, its docked set panel
 * and the toolbar's set picker, or a phone row's, which share the module. A failed warm-up is
 * harmless: the binder's own load retries.
 */
function preloadBinder(): void {
  import('./CollectionBinderSection').catch(() => {});
}

/** Starts the import dialog's chunk when the collection's actions menu opens, before Import collection is chosen. */
function preloadImportDialog(): void {
  import('./ImportCollectionDialog').catch(() => {});
}

/**
 * The NEWEST set, where a set the binder does not have falls back to while the pool
 * loads (`resolveSetCode`). Taken from `SET_NAMES` rather than the pool, which the
 * first click on Collection comes BEFORE (the toggle is what loads it), and a new set
 * cannot ship without its entry there (`SetCode` enforces it).
 */
const DEFAULT_SET = String(Math.max(...Object.keys(SET_NAMES).map(Number)));

/**
 * The set to show, the whole collection, or every promo set. Collection mode opens on
 * the whole collection (owner, 2026-10-20; the newest set before), unless a Browse set
 * filter names one (`setFromFilter`). A set the binder does not have (`?binder=99`)
 * falls back to the newest it does, rather than drawing an empty binder under a picker
 * naming a different set, and every promo set (`?binder=promos`) in a binder with none
 * to the whole collection. Until the list is known the request is trusted: nothing
 * contradicts it yet.
 */
function resolveSetCode(requested: string | null, sets: string[] | null): string {
  if (requested === null || requested === WHOLE_COLLECTION) return WHOLE_COLLECTION;
  if (requested === ALL_PROMO_SETS) return sets === null || sets.some(isPromoSet) ? ALL_PROMO_SETS : WHOLE_COLLECTION;
  if (sets === null || sets.includes(requested)) return requested;
  return sets[0] ?? DEFAULT_SET;
}

/**
 * The panel's list of sets: the real one once known, else just the current set, so the
 * panel's height never changes when the list arrives; none for a scope spanning sets.
 */
function panelSets(sets: string[] | null, setCode: string): string[] {
  if (sets !== null) return sets;
  return spansSets(setCode) ? [] : [setCode];
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
    writeShow: (show: BinderShow) => rewrite((next) => writeShowParam(next, show)),
  };
}

/**
 * `collection_mode_toggled` for the Collection switch's own on and off. A click that waits
 * on the account (`useCollectionClick`'s `'wait'`, the only entry with no collection in this
 * browser) opens the binder at once but counts as on only when the account answers with a
 * collection: an answer with none offers the import, which is no toggle. A second click
 * before the answer withdraws the first, so it sends no off either.
 */
function useModeToggleEvents(syncing: boolean, hasCollection: boolean) {
  // A ref, not state: whether a click waits changes nothing on screen.
  const waiting = useRef(false);
  useEffect(() => {
    if (!waiting.current || syncing) return;
    waiting.current = false;
    if (hasCollection) trackEvent('collection_mode_toggled', {state: 'on'});
  }, [syncing, hasCollection]);
  return {
    entered: () => {
      waiting.current = !hasCollection;
      if (hasCollection) trackEvent('collection_mode_toggled', {state: 'on'});
    },
    left: () => {
      if (!waiting.current) trackEvent('collection_mode_toggled', {state: 'off'});
      waiting.current = false;
    },
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
  /**
   * The collection's actions, a gear after Collection (owner, 2026-10-20), for the signed-in
   * in either mode: for now, Import collection. Null signed out.
   */
  modeActions: ReactNode;
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
  /**
   * The binder holds promos alone, one promo set or every one (owner, 2026-10-20): the page
   * offers no Rarity filter and applies none, since every card is a promo. The mode drops the
   * param too (`strayParams`); this covers the render before it is gone.
   */
  promoOnly: boolean;
  /**
   * Whether you hold the card toward the chosen headline (`isHeld`): a copy in either finish
   * for Complete, one in each it comes in for Master (#880). What Owned and Missing ask (owner,
   * 2026-10-20). A promo scope asks Complete's, the one headline its panel shows.
   */
  owns: (card: LorcanaCard) => boolean;
  /**
   * The cards changed by hand in the binder's current view, which its Owned and Missing views
   * keep (#826, `useKeptCards`): a first copy leaves a card where it was in Missing.
   */
  kept: ReadonlySet<string>;
  /** The sign-in and import dialogs, and the card window's copies stripe (#826), a portal. */
  prompts: ReactNode;
  /**
   * The set panel's body for the page's listing while collection mode is on, else
   * undefined. Where the page docks panels (desktop) it renders this on the binder's
   * right, and the binder section then leaves its own set panel out. It takes the
   * listing because its numbers count the cards the filters let through.
   */
  renderSetPanel: (listing: BrowseListing) => ReactNode | undefined;
  /**
   * The set picker for the toolbar, beside Collection, where the page docks the set panel
   * (desktop, owner 2026-10-20), while collection mode is on, else undefined.
   */
  renderSetPicker: (listing: BrowseListing) => ReactNode | undefined;
  /**
   * A phone's one row over the binder (owner, 2026-10-25, #969) while collection mode is on,
   * else undefined: the set button, Binder options with its `count`, and Collection. The page
   * draws it in place of its title and toolbar.
   */
  renderPhoneRow: (listing: BrowseListing, options: PhoneRowOptions) => ReactNode | undefined;
  /**
   * A phone's Binder sheet (#969), which Binder options opens, while collection mode is on, else
   * undefined: Show and the sort above the filters, the scope's numbers after them, all three
   * applied in the page's one URL write. The page draws it in place of its filter sheet.
   */
  renderPhoneSheet: (listing: BrowseListing, sheet: PhoneSheetOptions) => ReactNode | undefined;
}

/** What the page hands a phone's Binder sheet: its filter sheet's props, the sort, and its one write. */
export type PhoneSheetOptions = Omit<BinderSheetProps, 'show' | 'progress'>;

/** What the page hands a phone's binder row: Binder options' badge and press. */
interface PhoneRowOptions {
  /** The filters on, plus one while the binder shows only Owned or Missing. */
  count: number;
  /** Opens the Binder sheet. */
  onOpen: () => void;
}

/**
 * The headline Owned and Missing ask of in a scope: the one chosen, but Complete in a promo
 * scope, whose panel shows no other (`ScopeNumbers`): there a promo in both finishes held in
 * one (#880) would otherwise drop out of Owned under a Master set chosen on another set.
 */
const ownsAxis = (setCode: string, axis: Axis): Axis => (isPromoScope(setCode) ? 'complete' : axis);

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
  // What the panel's headlines count, Complete or Master, which Owned and Missing ask too
  // (owner, 2026-10-20): held here rather than in the panel, so the binder's view can ask it.
  const [axis, setAxis] = useState<Axis>('complete');

  // The cards changed by hand in this view of the binder, which its Owned and Missing views
  // keep: a view is the mode, the set, Owned or Missing, the headline they ask of, and the
  // sort (`useKeptCards`).
  const [searchParams] = useSearchParams();
  const view = [collectionMode, setCode, show, axis, searchParams.get(SORT_PARAM)].join('|');
  const {kept, keep} = useKeptCards(view);
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
  // Only the switch's own on and off count as toggles: a click that opens sign-in or the
  // import sends nothing here, and an import that lands in the binder is collection_imported.
  const toggles = useModeToggleEvents(syncing, hasCollection);
  const enterMode = () => {
    toggles.entered();
    enterBinder(setCode, sets);
  };
  const leaveMode = () => {
    toggles.left();
    leaveBinder();
  };
  const onCollectionClick = useCollectionClick(
    {signedIn: user !== null, hasCollection, syncing, active: collectionMode},
    {openSignIn: () => setShowSignIn(true), openImport, enter: enterMode, leave: leaveMode},
  );

  // Warmed only for an account: signed out, Collection opens sign-in, never the binder.
  const modeSwitch = (
    <CollectionModeSwitch
      active={collectionMode}
      onToggle={onCollectionClick}
      onIntent={user !== null ? preloadBinder : undefined}
    />
  );
  // Every action needs an account: none signed out. The import waits as Account's does.
  const modeActions =
    user !== null ? (
      <CollectionActions onImport={openImport} checking={syncing && !hasCollection} onMenuOpen={preloadImportDialog} />
    ) : null;

  const panelControls = {
    setCode,
    sets: panelSets(sets, setCode),
    setsLoading: sets === null,
    onSetChange: writeBinder,
    picksPromos: rarityPicksPromos(searchParams),
    show,
    onShowChange: writeShow,
    axis,
    onAxisChange: setAxis,
  };
  // What the docked panel and the toolbar's set picker count: the cards the page lets through.
  const setCounts = (listing: BrowseListing) => ({
    cards: listing.matched,
    filtered: listing.filtered,
    entries,
    isLoading: syncing || !isReady,
  });

  function renderBinder(listing: BrowseListing, onCardSelect: (card: LorcanaCard) => void) {
    if (!collectionMode) return null;
    return (
      <Suspense fallback={<BinderChunkFallback />}>
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
      <SignInDialog isOpen={showSignIn} onClose={() => setShowSignIn(false)} surface="collection" />
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
            context={{surface: 'browse', replacing: hasCollection}}
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
    modeActions,
    renderBinder,
    modalTarget: collectionMode
      ? (cardId, listing) => binderModalTarget(cardId, listing, {pool, setCode, sets: panelControls.sets})
      : null,
    sortOptions: collectionMode ? BINDER_SORT_OPTIONS : undefined,
    show,
    rarityOptions: binderRarities,
    promoOnly: collectionMode && isPromoScope(setCode),
    owns: (card) => isHeld(card, entries, ownsAxis(setCode, axis)),
    kept,
    prompts,
    renderSetPanel: (listing) =>
      collectionMode ? (
        <Suspense fallback={<DockedSetBodyFallback promo={isPromoScope(setCode)} />}>
          <DockedSetBody {...setCounts(listing)} {...panelControls} />
        </Suspense>
      ) : undefined,
    renderSetPicker: (listing) =>
      collectionMode ? (
        <Suspense fallback={<ToolbarSetPickerFallback />}>
          <DockedSetPicker {...setCounts(listing)} {...panelControls} />
        </Suspense>
      ) : undefined,
    renderPhoneRow: (listing, {count, onOpen}) =>
      collectionMode ? (
        <PhoneBinderRow
          setPicker={
            <Suspense fallback={<RowSetPickerFallback />}>
              <PhoneSetPicker {...setCounts(listing)} {...panelControls} />
            </Suspense>
          }
          count={count}
          onOpen={onOpen}
          modeSwitch={modeSwitch}
        />
      ) : undefined,
    renderPhoneSheet: (listing, sheet) =>
      collectionMode ? (
        <BinderSheet
          {...sheet}
          show={show}
          progress={
            <Suspense fallback={<SheetNumbersFallback promo={isPromoScope(setCode)} />}>
              <PhoneSetNumbers {...setCounts(listing)} {...panelControls} />
            </Suspense>
          }
        />
      ) : undefined,
  };
}
