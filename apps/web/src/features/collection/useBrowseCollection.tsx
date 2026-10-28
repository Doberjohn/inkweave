import {Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {useLocation, useSearchParams, type Location} from 'react-router-dom';
import {SET_PARAM, SORT_PARAM} from '../../shared/hooks/useFilterParams';
import {trackEvent} from '../../shared/lib/analytics';
import {lazyWithRetry} from '../../shared/lib/lazyWithRetry';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SignInDialog} from '../../shared/components/SignInDialog';
import {SET_NAMES, type BrowseSortOrder} from '../../shared/constants';
import {useSession} from '../../shared/contexts/SessionContext';
import {useCollection} from './CollectionContext';
import type {CollectionEntries, Finish} from './collectionParser';
import type {Axis} from './collectionStats';
import {countCompare, inViewOf, type Compare} from './compareCollections';
import {useKeptCards} from './useKeptCards';
import {useCollectionCards, useCollectionPool} from './CollectionCardsContext';
import {useCollectionClick} from './useCollectionClick';
import {binderModalTarget, type ModalTarget} from './collectionModalTarget';
import {
  ALL_PROMO_SETS,
  BINDER_PARAM,
  BINDER_SORT_OPTIONS,
  COMPARE_SHOWS,
  FRIEND_PARAM,
  OWNED_PARAM,
  WHOLE_COLLECTION,
  binderCardsForSet,
  binderRarities,
  binderSets,
  isPromoScope,
  ownsAxis,
  isPromoSet,
  parseBinderShow,
  rarityPicksPromos,
  scopeSets,
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
import {SHOW_FRIENDS} from '../friends/flag';
import {PhoneBinderRow} from './PhoneBinderRow';
import {BinderSheet, type BinderSheetProps} from './BinderSheet';
import type {CompareCounts} from './BinderShows';
import {FriendBinderBanner, FriendNotSharing} from './FriendBinderBanner';
import {useFriendCollection, type FriendBinder} from './useFriendCollection';
import type {BinderStart} from './CollectionBinderSection';
import type {AtCard} from './FriendsWhoHaveIt';
import {
  BinderChunkFallback,
  DockedSetBodyFallback,
  RowSetPickerFallback,
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
// nor does a phone row's set picker.
const DockedSetBody = lazyWithRetry(() => import('./CollectionBinderSection'), 'DockedSetBody');
const DockedSetPicker = lazyWithRetry(() => import('./CollectionBinderSection'), 'DockedSetPicker');
const PhoneSetPicker = lazyWithRetry(() => import('./CollectionBinderSection'), 'PhoneSetPicker');
const ImportCollectionDialog = lazyWithRetry(
  () => import('./ImportCollectionDialog'),
  'ImportCollectionDialog',
);
// Friends who have it, and the friends' reads behind it: loaded only with the friends flag on.
const CollectionFriends = lazyWithRetry(() => import('./CollectionFriends'), 'CollectionFriends');
const PocketFriends = lazyWithRetry(() => import('./CollectionFriends'), 'PocketFriends');
const FoilPointer = lazyWithRetry(() => import('./CollectionFriends'), 'FoilPointer');

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
function binderMode(requested: string | null, reader: BinderReader, friend: boolean): BinderMode {
  if (requested === null) return {active: false, dead: false, dropsStrays: true};
  if (friend) return friendBinderMode(reader);
  const pending = reader.sessionLoading || reader.syncing;
  const honoured = !pending && reader.signedIn && reader.hasCollection;
  const active = pending || honoured;
  return {active, dead: reader.signedIn && !active, dropsStrays: honoured};
}

/**
 * What `?binder=` gets with `?friend=`: a friend's binder, honoured for any signed-in
 * reader once the session is known, whether or not they hold a collection of their own.
 * Signed out it keeps the grid, as any `?binder=` link does, and keeps the params, so signing
 * in opens the friend's binder. Never dead: the friend decides what it shows.
 */
function friendBinderMode(reader: BinderReader): BinderMode {
  const honoured = !reader.sessionLoading && reader.signedIn;
  return {active: reader.sessionLoading || honoured, dead: false, dropsStrays: honoured};
}

/** Whether a view is one only a friend's binder has: You need or They need. */
const comparesWith = (raw: string | null) => COMPARE_SHOWS.some((show) => show === raw);

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
  // Whose binder: a friend's, by handle, only under the friends flag, without which
  // the param changes nothing. Outside the binder it is a stray.
  const friend = requested === null || !SHOW_FRIENDS ? null : searchParams.get(FRIEND_PARAM);
  const mode = binderMode(requested, reader, friend !== null);
  const hasStrays = mode.dropsStrays && strayParams(searchParams).length > 0;
  useEffect(() => {
    if (!hasStrays) return;
    setSearchParams(withoutStrays, {replace: true});
  }, [hasStrays, setSearchParams]);

  return {
    requested,
    friend,
    mode,
    // You need and They need ask of the reader's own collection too, so only a reader with one
    // (or whose account has yet to answer) gets them.
    show: parseBinderShow(searchParams.get(OWNED_PARAM), friend !== null && (reader.hasCollection || reader.syncing)),
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
    // Back to the reader's own binder at the same scope: the views only a friend's has go too.
    leaveFriend: () =>
      rewrite((next) => {
        next.delete(FRIEND_PARAM);
        if (comparesWith(next.get(OWNED_PARAM))) next.delete(OWNED_PARAM);
      }),
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
   * Whether a card is in the binder's view, or null for All. Owned and Missing ask whether the
   * binder's collection holds it toward the chosen headline (`isHeld`): a copy in either finish
   * for Complete, one in each it comes in for Master (#880; owner, 2026-10-20). A friend's
   * binder asks theirs, and its You need and They need ask whether one of you holds it
   * in a finish the other lacks (`holdsWhatTheyLack`). A promo scope asks Complete's, the one
   * headline its panel shows.
   */
  inView: ((card: LorcanaCard) => boolean) | null;
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
   * else undefined: Filters with its `count`, the set button and Collection. The page
   * draws it in place of its title and toolbar.
   */
  renderPhoneRow: (listing: BrowseListing, options: PhoneRowOptions) => ReactNode | undefined;
  /**
   * A phone's Binder sheet, which the row's Filters opens, while collection mode is on, else
   * undefined: Show and the sort above the filters, the scope's numbers after them, all three
   * applied in the page's one URL write. The page draws it in place of its filter sheet.
   */
  renderPhoneSheet: (listing: BrowseListing, sheet: PhoneSheetOptions) => ReactNode | undefined;
  /**
   * A friend's binder's banner, above the toolbar in the title's place, while one
   * shows, else undefined: whose binder, Read only, and the way back.
   */
  renderBanner: (listing: BrowseListing, isMobile: boolean) => ReactNode | undefined;
}

/** What the page hands a phone's Binder sheet: its filter sheet's props, the sort, and its one write. */
export type PhoneSheetOptions = Omit<BinderSheetProps, 'show'>;

/** What the page hands a phone's binder row: its Filters' badge and press. */
interface PhoneRowOptions {
  /** The filters on, plus one while the binder shows only Owned or Missing. */
  count: number;
  /** Opens the Binder sheet. */
  onOpen: () => void;
}

const NO_ENTRIES: CollectionEntries = {};

/** A friend's binder's state while one is asked for: loading until its hook answers. */
const friendBinderOf = (handle: string | null, binder: FriendBinder | null): FriendBinder | null =>
  handle === null ? null : (binder ?? {status: 'loading'});

/** Said in the binder's place when a friend's collection didn't load; its Try again reads it again. */
const FRIEND_FAILED = "Couldn't load this binder.";

/** The cards of a scope, in no particular order: what the compare counts go over. */
const scopeCardsOf = (cards: readonly LorcanaCard[], setCode: string, sets: readonly string[]) =>
  scopeSets(setCode, sets).flatMap((set) => binderCardsForSet(cards, set));

/** A scope of the page's cards: what the compare counts go over. */
interface CompareScope {
  cards: readonly LorcanaCard[];
  setCode: string;
  sets: readonly string[];
}

/** The last You need and They need counted, with what they were counted from (`countScopeOnce`). */
let lastCompare: {inputs: readonly unknown[]; counts: CompareCounts} | null = null;

/**
 * `countCompare` over a scope's cards, counted once for the same inputs: the banner, the binder,
 * the set panel and the phone sheet each ask for it in one render, and each count runs over
 * every card in the scope, set by set.
 */
function countScopeOnce(scope: CompareScope, compare: Compare, axis: Axis): CompareCounts {
  const inputs = [scope.cards, scope.setCode, scope.sets, compare.mine, compare.theirs, axis];
  if (lastCompare?.inputs.every((input, i) => Object.is(input, inputs[i]))) return lastCompare.counts;
  const counts = countCompare(scopeCardsOf(scope.cards, scope.setCode, scope.sets), compare, axis);
  lastCompare = {inputs, counts};
  return counts;
}

/** You need and They need ask of both collections: until both are in, the binder shows All, as Show does. */
const shownOf = (show: BinderShow, compare: Compare | null): BinderShow =>
  compare === null && comparesWith(show) ? 'all' : show;

/** The card a friend's binder opens at: Friends who have it's row names it in the router's state, never the address. */
function startAtOf({state, key}: Location): BinderStart | undefined {
  const atCard = (state as Partial<AtCard> | null)?.atCard;
  return typeof atCard === 'string' ? {cardId: atCard, key} : undefined;
}

/** A friend who doesn't share, or whose binder didn't load, leaves the binder's place to a line saying so. */
const hidesPanel = (friend: FriendBinder | null) => friend?.status === 'not-sharing' || friend?.status === 'failed';

/** What a friend's binder shows, and beside what (`useFriendView`). */
interface FriendView {
  /** The friend's binder while `?friend=` names one in collection mode, else null. */
  friend: FriendBinder | null;
  /** The copies the binder, the panel and Owned and Missing read: the friend's, or the reader's own. */
  shown: CollectionEntries;
  /** In a friend's binder, the reader's own copies, for the panel's "You" lines; absent without a collection. */
  yours: CollectionEntries | undefined;
  /** Both collections, for You need and They need: a friend's binder on show, beside a collection of your own. */
  compare: Compare | null;
  /** The friend's binder is still to answer, or names the reader, whose own binder takes its place. */
  waiting: boolean;
}

/**
 * A friend's binder beside the reader's own collection. The friend's copies are placed
 * as the reader's are (`place`), at render, since the placements grow as the collection's card
 * data loads. A handle that is the reader's own drops `?friend=`, opening their own binder.
 */
function useFriendView(handle: string | null, readerId: string | null, leaveFriend: () => void): FriendView {
  const {entries, hasCollection, place} = useCollection();
  const friend = friendBinderOf(handle, useFriendCollection(handle, readerId));
  const own = friend?.status === 'own';
  useEffect(() => {
    if (own) leaveFriend();
  }, [own, leaveFriend]);
  if (friend === null) return {friend, shown: entries, yours: undefined, compare: null, waiting: false};
  return friendViewOf(friend, friend.status === 'shown' ? place(friend.entries) : null, hasCollection ? entries : undefined);
}

/** A friend's binder beside the reader's copies (`mine`, absent without a collection). */
function friendViewOf(friend: FriendBinder, theirs: CollectionEntries | null, mine: CollectionEntries | undefined): FriendView {
  return {
    friend,
    shown: theirs ?? NO_ENTRIES,
    yours: mine,
    compare: theirs && mine ? {mine, theirs} : null,
    waiting: friend.status === 'loading' || friend.status === 'own',
  };
}

/** The friend's public name, once their binder has answered with one. */
function friendNameOf(friend: FriendBinder): string | null {
  if (friend.status === 'shown') return friend.friend.name;
  return friend.status === 'not-sharing' ? friend.name : null;
}

/** What the binder says while its copies are still to come, or failed to: the reader's own copy's, or a friend's binder's. */
interface BinderStatus {
  error: string | null;
  onRetry: () => void;
}

/** A friend's binder that didn't load says so, with its own Try again; the card data's failure comes first. */
function binderStatusOf(friend: FriendBinder | null, own: BinderStatus): BinderStatus {
  if (friend?.status !== 'failed' || own.error !== null) return own;
  return {error: FRIEND_FAILED, onRetry: friend.retry};
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
  const {hasCollection, syncing, importCollection, setCount} = useCollection();
  const {retry} = useCollectionCards();
  const {requested, friend: friendHandle, mode, show: asked, enterBinder, writeBinder, leaveBinder, writeShow, leaveFriend} =
    useBinderParams({
      sessionLoading,
      syncing,
      signedIn: user !== null,
      hasCollection,
    });

  const {active: collectionMode, dead} = mode;
  useEffect(() => {
    if (dead) leaveBinder();
  }, [dead, leaveBinder]);
  const friendView = useFriendView(collectionMode ? friendHandle : null, user?.id ?? null, leaveFriend);
  const {friend} = friendView;
  const show = shownOf(asked, friendView.compare);
  const location = useLocation();

  // Only collection mode (or the import, which parses against the full pool)
  // widens the pool, so a visitor who never switches fetches no chunks at all.
  const {pool, waiting, error, isReady} = useCollectionPool(coreCards, collectionMode || showImport);
  const sets = isReady ? binderSets(pool) : null;
  const setCode = resolveSetCode(requested, sets);
  // What the panel's headlines count, Complete or Master, which Owned and Missing ask too
  // (owner, 2026-10-20): held here rather than in the panel, so the binder's view can ask it.
  const [axis, setAxis] = useState<Axis>('complete');

  // The cards changed by hand in this view of the binder, which its Owned and Missing views
  // keep: a view is the mode, whose binder, the set, Owned or Missing, the headline they ask
  // of, and the sort (`useKeptCards`).
  const [searchParams] = useSearchParams();
  const view = [collectionMode, friend === null ? '' : friendHandle, setCode, show, axis, searchParams.get(SORT_PARAM)].join(
    '|',
  );
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

  // Warmed only for an account: signed out, Collection opens sign-in, never the binder. In a
  // friend's binder it leaves for the grid, as it would leave your own, but toggles nothing of yours.
  const modeSwitch = (
    <CollectionModeSwitch
      active={collectionMode}
      onToggle={friend === null ? onCollectionClick : leaveBinder}
      onIntent={user !== null ? preloadBinder : undefined}
    />
  );
  // Every action needs an account: none signed out, and none in a friend's binder, which is
  // read only. The import waits as Account's does.
  const modeActions =
    user !== null && friend === null ? (
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
  // You need and They need, counted over the scope's cards the page lets through, as the
  // panel's numbers are; null outside a friend's binder, or for a reader with no collection.
  const compareFor = (listing: BrowseListing): CompareCounts | null =>
    friendView.compare &&
    countScopeOnce({cards: listing.matched, setCode, sets: panelControls.sets}, friendView.compare, ownsAxis(setCode, axis));
  // What the docked panel and the set pickers count: the cards the page lets through. Only the
  // docked panel draws the reader's own "You" lines, so it alone is handed their copies.
  const setCounts = (listing: BrowseListing) => ({
    cards: listing.matched,
    filtered: listing.filtered,
    entries: friendView.shown,
    isLoading: (friend === null ? syncing : friendView.waiting) || !isReady,
  });
  // No panel and no picker beside a friend's binder that isn't there.
  const binderShows = collectionMode && !hidesPanel(friend);

  // Friends who have a card for the reader: with both flags on, for a reader with a collection.
  // Their badges and the foil pointer show in the reader's own binder only.
  const friendsHave = SHOW_FRIENDS && user !== null && hasCollection;
  const ownFriends = friendsHave && friend === null;
  const pocketBadge = ownFriends
    ? (card: LorcanaCard) => (
        <Suspense fallback={null}>
          <PocketFriends card={card} axis={ownsAxis(setCode, axis)} />
        </Suspense>
      )
    : undefined;
  const renderFoilPointer = ownFriends
    ? (cards: readonly LorcanaCard[]) => (
        <Suspense fallback={null}>
          <FoilPointer cards={cards} onShow={() => setAxis('master')} />
        </Suspense>
      )
    : undefined;

  // Loading while the account's copy is still to answer, or a friend's binder.
  const binderLoading = (friend === null ? syncing : friendView.waiting) || (!isReady && error === null);
  const binderStatus = binderStatusOf(friend, {error, onRetry: retry});

  function renderBinder(listing: BrowseListing, onCardSelect: (card: LorcanaCard) => void) {
    if (!collectionMode) return null;
    if (friend?.status === 'not-sharing') return <FriendNotSharing name={friend.name} handle={friend.handle} />;
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
          entries={friendView.shown}
          yourEntries={friendView.yours}
          friend={friend !== null}
          isLoading={binderLoading}
          {...binderStatus}
          {...panelControls}
          compare={compareFor(listing)}
          onCardSelect={onCardSelect}
          // A friend's binder is read only: no − and + in its pockets.
          onCountChange={friend === null ? changeCount : undefined}
          startAt={friend === null ? undefined : startAtOf(location)}
          pocketBadge={pocketBadge}
          renderFoilPointer={renderFoilPointer}
        />
      </Suspense>
    );
  }

  // Back to the reader's own binder, or for a reader with none, out to the grid.
  const back = hasCollection ? ({back: 'yours', onBack: leaveFriend} as const) : ({back: 'browse', onBack: leaveBinder} as const);

  function renderBanner(listing: BrowseListing, isMobile: boolean) {
    // Outside collection mode there is no friend's binder (`useFriendView` gets no handle).
    if (friend === null || friendHandle === null) return undefined;
    return (
      <FriendBinderBanner
        isMobile={isMobile}
        name={friendNameOf(friend)}
        handle={friendHandle}
        shown={friend.status === 'shown'}
        // Only a friend's binder on show beside your own collection counts any.
        youNeed={compareFor(listing)?.youNeed ?? null}
        {...back}
      />
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
      {/* The card window keeps your own copies, in a friend's binder too. */}
      <WindowCopies onEdit={keep} />
      {friendsHave && (
        <Suspense fallback={null}>
          <CollectionFriends axis={ownsAxis(setCode, axis)} />
        </Suspense>
      )}
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
    inView: inViewOf(show, ownsAxis(setCode, axis), friendView),
    kept,
    prompts,
    renderSetPanel: (listing) =>
      binderShows ? (
        <Suspense fallback={<DockedSetBodyFallback promo={isPromoScope(setCode)} />}>
          <DockedSetBody
            {...setCounts(listing)}
            yourEntries={friendView.yours}
            {...panelControls}
            compare={compareFor(listing)}
          />
        </Suspense>
      ) : undefined,
    renderSetPicker: (listing) =>
      binderShows ? (
        <Suspense fallback={<ToolbarSetPickerFallback />}>
          <DockedSetPicker {...setCounts(listing)} {...panelControls} />
        </Suspense>
      ) : undefined,
    renderPhoneRow: (listing, {count, onOpen}) =>
      binderShows ? (
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
      binderShows ? <BinderSheet {...sheet} show={show} compare={compareFor(listing)} /> : undefined,
    renderBanner,
  };
}
