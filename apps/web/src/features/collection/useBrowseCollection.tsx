import {Suspense, useEffect, useRef, useState, type ReactNode} from 'react';
import {useLocation, useSearchParams, type Location} from 'react-router-dom';
import {SORT_PARAM, type FilterDraft} from '../../shared/hooks/useFilterParams';
import {trackEvent} from '../../shared/lib/analytics';
import {lazyWithRetry} from '../../shared/lib/lazyWithRetry';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {SignInDialog} from '../../shared/components/SignInDialog';
import type {BrowseSortOrder} from '../../shared/constants';
import {useSession} from '../../shared/contexts/SessionContext';
import {useCollection} from './CollectionContext';
import type {CollectionEntries} from './collectionParser';
import {trackViewPick, trackedPicks} from './binderEvents';
import type {Axis} from './collectionStats';
import {countCompare, inViewOf, type Compare} from './compareCollections';
import {useHandCounts} from './useHandCounts';
import {useCollectionCards, useCollectionPool} from './CollectionCardsContext';
import {collectionClick} from './collectionAction';
import {binderModalTarget, type ModalTarget} from './collectionModalTarget';
import {
  BINDER_SORT_OPTIONS,
  SHELF,
  WHOLE_COLLECTION,
  binderCardsForSet,
  binderRarities,
  binderSets,
  isPromoScope,
  ownsAxis,
  rarityPicksPromos,
  scopeSets,
  type BinderShow,
} from './binderCards';
import {comparesWith, panelSets, resolveSetCode, useBinderParams} from './useBinderParams';
import {CollectionModeSwitch} from './CollectionModeSwitch';
import {CollectionActions} from './CollectionActions';
import {WindowCopies} from './WindowCopies';
import {PhoneBinderRow, PhoneShelfRow} from './PhoneBinderRow';
import {BinderSheet, type BinderSheetProps} from './BinderSheet';
import type {CompareCounts} from './BinderShows';
import {FriendBinderBanner, FriendNotSharing} from './FriendBinderBanner';
import {useFriendCollection, type BinderFrom, type FriendBinder} from './useFriendCollection';
import type {BinderStart} from './CollectionBinderSection';
import type {AtCard} from './FriendsWhoHaveIt';
import type {BinderEntry} from '../friends/friendBinderPath';
import {
  BinderChunkFallback,
  DockedSetBodyFallback,
  RowSetPickerFallback,
  ToolbarSetPickerFallback,
} from './BinderChunkFallback';
import {DEFAULT_SIDE, TODAY_PAGE, squarePage, type BinderGrid, type PageSide} from '../cards/components/binderGeometry';
import {SHOW_BINDERS} from './binders/flag';
import type {BinderChoices, CustomBinder, OwnBinders} from './binders/binderChoices';
import {ShelfHeading} from './binders/ShelfHeading';
import {useShelf, type ShelfSlot} from './binders/useShelf';
import {useBinderWindow, type BinderWindowSlot} from './binders/useBinderWindow';
import {useSaveAsBinder, type SaveSlot} from './binders/useSaveAsBinder';
import {rememberedPages} from './binders/rememberedPages';
import {useOwnBinders} from './useOwnBinders';

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
// Friends who have it, and the friends' reads behind it: loaded only for a reader with a collection.
const CollectionFriends = lazyWithRetry(() => import('./CollectionFriends'), 'CollectionFriends');
const PocketFriends = lazyWithRetry(() => import('./CollectionFriends'), 'PocketFriends');
const FoilPointer = lazyWithRetry(() => import('./CollectionFriends'), 'FoilPointer');

/*
 * BINDERS OF YOUR OWN LOAD ONLY WITH THEIR FLAG ON (`binders/flag.ts`): the import folds
 * away on SHOW_BINDERS at build time, and `binderCodeGuard` fails a build in which a page could
 * still load binder code with the flag off. `useOwnBinders` loads the rest the same way.
 */
const UnknownBinder = SHOW_BINDERS ? lazyWithRetry(() => import('./binders/UnknownBinder'), 'UnknownBinder') : null;
// The shelf (#1074): its covers and their menus in a chunk of their own; its heading and the hook
// that decides whether it stays are small, and picked here, so off they fold away too. These two
// test the env itself, not SHOW_BINDERS: Rolldown tree-shakes before it inlines another module's
// constant, so a static import picked on SHOW_BINDERS keeps its code with binders off.
const BinderShelf = SHOW_BINDERS ? lazyWithRetry(() => import('./binders/BinderShelf'), 'BinderShelf') : null;
const noShelf = (): ShelfSlot | null => null;
const useShelfOf = import.meta.env.VITE_SHOW_BINDERS === 'true' ? useShelf : noShelf;
const Heading = import.meta.env.VITE_SHOW_BINDERS === 'true' ? ShelfHeading : null;
// The New binder window's place on the page, picked the same way: the window itself is lazy.
const NO_WINDOW: BinderWindowSlot = {open: null, node: null};
const noWindow = () => NO_WINDOW;
const useWindowOf = import.meta.env.VITE_SHOW_BINDERS === 'true' ? useBinderWindow : noWindow;
// Save as a binder's foot and box, picked the same way: the box is lazy.
const NO_SAVE: SaveSlot = {render: () => null, node: null};
const noSave = () => NO_SAVE;
const useSaveOf = import.meta.env.VITE_SHOW_BINDERS === 'true' ? useSaveAsBinder : noSave;
// My collection's page size as this browser last saw it, for its loading binder: picked the same way.
const noPages: typeof rememberedPages = () => null;
const rememberedOf = import.meta.env.VITE_SHOW_BINDERS === 'true' ? rememberedPages : noPages;

/**
 * Starts the binder's chunk on intent (#913): one request for the binder, its docked set panel
 * and the toolbar's set picker, or a phone row's, which share the module; with binders on, the
 * shelf's too, where Collection lands. A failed warm-up is harmless: the binder's own load retries.
 */
function preloadBinder(): void {
  import('./CollectionBinderSection').catch(() => {});
  if (SHOW_BINDERS) import('./binders/BinderShelf').catch(() => {});
}

/** Starts the import dialog's chunk when the collection's actions menu opens, before Import collection is chosen. */
function preloadImportDialog(): void {
  import('./ImportCollectionDialog').catch(() => {});
}

/**
 * `collection_mode_toggled` for the Collection switch's own on and off. A click with no
 * collection in this browser (`collectionAction`'s `'start'`) opens the binder at once but
 * counts as on only once a collection is there, its own or the one started for it, a Try again
 * after a start that made none included. Until then it is no toggle, so leaving sends no off.
 */
function useModeToggleEvents(syncing: boolean, hasCollection: boolean) {
  // A ref, not state: whether a click waits changes nothing on screen.
  const waiting = useRef(false);
  useEffect(() => {
    const arrived = hasCollection && !syncing;
    if (!waiting.current || !arrived) return;
    waiting.current = false;
    trackEvent('collection_mode_toggled', {state: 'on'});
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

/** What collection mode adds to Browse. */
export interface BrowseCollectionSlots {
  /** True while collection mode is on: the binder replaces the grid. */
  active: boolean;
  /** The pool to filter: Core alone, or Core plus the collection once the mode is on. */
  pool: LorcanaCard[];
  /** The toolbar's mode control: the Collection toggle. */
  modeSwitch: ReactNode;
  /**
   * The binder shelf on show (#1074), else null: its heading, which the toolbar draws in place of
   * its filters, the sort and the search. The page then docks no panel beside it.
   */
  shelf: {heading: ReactNode} | null;
  /**
   * The collection's actions, a gear after Collection (owner, 2026-10-20), for the signed-in
   * in either mode: for now, Import collection. Null signed out.
   */
  modeActions: ReactNode;
  /**
   * Collection mode's content for the page's listing, or null to keep the grid. A pocket's card
   * goes to `onCardSelect` with the binder it was picked in.
   */
  renderBinder: (
    listing: BrowseListing,
    onCardSelect: (card: LorcanaCard, source: BinderCardSource) => void,
  ) => ReactNode | null;
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
   * That picker names a binder of your own, so the toolbar gives its button the room its
   * name needs (owner, 2026-11-03).
   */
  pickerNamesBinder: boolean;
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
  /**
   * Save as a binder for these filters and search, at the foot of each filter surface:
   * null unless they make a binder of your own (binders on, your own binder or My collection on
   * show, room on the shelf, a filter or the search on, and rules that join). `before` runs first
   * on a press: the dialog's and the Binder sheet's Apply and close.
   */
  renderSaveAsBinder: (draft: FilterDraft, query: string, before?: () => void) => ReactNode;
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

/**
 * Where the friend's binder on show was reached from: the state of the link followed, else its
 * address alone. State no link writes, such as a history entry an older build wrote, counts as
 * the address.
 */
function binderFromOf({state}: Location): BinderFrom {
  const from = (state as Partial<BinderEntry> | null)?.binderFrom;
  return from === 'friends_list' || from === 'friends_who_have_it' ? from : 'link';
}

/** Where a binder's card was opened: your own binder, or a friend's (`card_selected`'s `source`). */
export type BinderCardSource = 'binder' | 'friend_binder';

const binderSourceOf = (friend: FriendBinder | null): BinderCardSource => (friend === null ? 'binder' : 'friend_binder');

/** Where Browse opens the import: its gear menu, or an empty binder's cover. */
type ImportSurface = 'browse' | 'empty_binder';

/**
 * The import an empty binder's cover offers: in the reader's own binder, while their collection
 * holds no copies, so the cover says how a first one goes in.
 */
function emptyImportOf(
  friend: FriendBinder | null,
  {hasCollection, holdsCopies}: {hasCollection: boolean; holdsCopies: boolean},
  openImport: () => void,
): (() => void) | undefined {
  return friend === null && hasCollection && !holdsCopies ? openImport : undefined;
}

/** A friend who doesn't share, or whose binder didn't load, leaves the binder's place to a line saying so. */
const hidesPanel = (friend: FriendBinder | null) => friend?.status === 'not-sharing' || friend?.status === 'failed';

/** What the page knows when it asks for your binders. */
interface BinderAskedBy {
  uid: string | null;
  hasCollection: boolean;
  syncing: boolean;
  collectionMode: boolean;
  friendHandle: string | null;
  customId: string | null;
}

/** What the shelf is asked: your binders once collection mode opens your own, and the one `?custom=` names. */
function binderAsk({uid, hasCollection, syncing, collectionMode, friendHandle, customId}: BinderAskedBy) {
  return {
    uid,
    hasCollection,
    syncing,
    wanted: collectionMode && friendHandle === null,
    requested: collectionMode ? customId : null,
  };
}

/** Whether the picker names a binder of your own, whose name needs more room than a set's number. */
const namesOwnBinder = (binders: BinderChoices | undefined) => binders?.open != null;

/** A binder of your own that isn't on your shelf, or whose shelf didn't load, leaves the binder's place to a line too. */
const hidesOwnPanel = (custom: CustomBinder) => custom.status === 'unknown' || custom.status === 'failed';

/**
 * Whether the binder and its pickers are drawn: never outside collection mode, and never beside
 * a binder that isn't there, a friend's, one whose start made no collection, or one of your own
 * that isn't on your shelf.
 */
function binderIsDrawn({friend, custom, problem}: {friend: FriendBinder | null; custom: CustomBinder; problem: string | null}): boolean {
  if (problem !== null) return false;
  return !hidesPanel(friend) && !hidesOwnPanel(custom);
}

/** What the reader's own binder still waits on: the account's copy, and the shelf for a binder of your own. */
const waitsOnYours = (syncing: boolean, custom: CustomBinder) => syncing || custom.status === 'loading';

/** The binder's sets, once the pool is in and, for a binder of your own, the shelf has answered. */
function binderSetsNow(pool: readonly LorcanaCard[], isReady: boolean, custom: CustomBinder): string[] | null {
  if (!isReady || custom.status === 'loading') return null;
  return binderSets(pool);
}

/** Said in the binder's place when the reader's binders didn't load; its Try again reads them again. */
const BINDERS_FAILED = "Couldn't load your binders.";

/** A binder of your own whose shelf didn't load says so, with its Try again; the reader's own binder's failure comes first. */
function customStatusOf(custom: CustomBinder, own: BinderStatus): BinderStatus {
  if (custom.status !== 'failed' || own.error !== null) return own;
  return {error: BINDERS_FAILED, onRetry: custom.retry};
}

/** Where the set picker's Binders tab stands: the binder on show, and what each row counts. */
interface ChoicesAt {
  friend: FriendBinder | null;
  setCode: string;
  entries: CollectionEntries;
  /** The whole pool, null while it loads. */
  pool: readonly LorcanaCard[] | null;
}

/**
 * What the set picker, the panel and the binder know of your binders: none where binders are off,
 * and none in a friend's binder, which shows none of yours.
 */
function binderChoicesOf(
  {shelf, custom}: OwnBinders,
  {friend, setCode, entries, pool}: ChoicesAt,
  opens: Pick<BinderChoices, 'onOpen' | 'onShelf' | 'onNewBinder'>,
): BinderChoices | undefined {
  if (shelf === null || friend !== null) return undefined;
  const open = custom.status === 'shown' ? custom : null;
  return {open, atOwnScope: setCode === (open?.binder.scope ?? WHOLE_COLLECTION), shelf, pool, entries, ...opens};
}

/**
 * The page the binder draws: today's 4 by 3 where binders are off. With them on, the binder on
 * show's own size: a binder of your own's, My collection's once the shelf has read it, and a
 * friend's 4 by 4, since a player's shelf row is theirs alone to read. Null while My collection's
 * is still to come: the binder waits for it rather than draw a page that changes as it lands, and
 * its loading frame draws the size this browser `remembered`.
 */
export function binderGridOf(
  {shelf, custom}: Pick<OwnBinders, 'shelf' | 'custom'>,
  friend: FriendBinder | null,
  remembered: PageSide | null,
): BinderGrid | null {
  if (shelf === null) return TODAY_PAGE;
  if (friend !== null) return squarePage(DEFAULT_SIDE);
  if (custom.status === 'shown') return squarePage(custom.binder.pages);
  if (shelf.status === 'loading') return null;
  // A shelf that didn't load, or none to read (signed out), leaves My collection at the size
  // remembered, else a new binder's. Idle while the account's copy syncs, the binder waits anyway.
  return squarePage(shelf.myCollection?.pages ?? remembered ?? DEFAULT_SIDE);
}

/** The Binders tab's New binder: the window, whose new binder then opens. Null until the window can open. */
const newBinderFrom = ({open}: BinderWindowSlot, openBinder: BinderChoices['onOpen']) =>
  open && (() => open({binder: null, onSaved: openBinder}));

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
  const friend = friendBinderOf(handle, useFriendCollection(handle, readerId, binderFromOf(useLocation())));
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

/** The reader's own binder's failure, with its Try again: the card data's first, then a start that made no collection. */
function ownStatusOf(cards: BinderStatus, startProblem: string | null, startAgain: () => void): BinderStatus {
  return cards.error === null && startProblem !== null ? {error: startProblem, onRetry: startAgain} : cards;
}

/** A friend's binder that didn't load says so, with its own Try again; the card data's failure comes first. */
function binderStatusOf(friend: FriendBinder | null, own: BinderStatus): BinderStatus {
  if (friend?.status !== 'failed' || own.error !== null) return own;
  return {error: FRIEND_FAILED, onRetry: friend.retry};
}

/**
 * Collection mode's state and controls for Browse, in one place so the page only
 * slots them in. Requires the collection providers, which the `CollectionScope`
 * layout route mounts.
 */
export function useBrowseCollection(coreCards: LorcanaCard[]): BrowseCollectionSlots {
  const [showSignIn, setShowSignIn] = useState(false);
  const [showImport, setShowImport] = useState(false);
  // Mounted from first open on, so closing plays DialogShell's exit instead of
  // unmounting mid-animation; never mounted at all for anyone who never opens it.
  const [importMounted, setImportMounted] = useState(false);
  const {user, loading: sessionLoading} = useSession();
  const {entries, hasCollection, holdsCopies, syncing, importCollection, startCollection, startProblem, cancelStart, setCount} =
    useCollection();
  const {retry} = useCollectionCards();
  const {
    requested,
    friend: friendHandle,
    custom: customId,
    onShelf,
    mode,
    show: asked,
    enterBinder,
    writeBinder,
    openBinder,
    openShelf,
    shelfToBinder,
    leaveBinder,
    writeShow,
    leaveFriend,
  } = useBinderParams({
      sessionLoading,
      syncing,
      signedIn: user !== null,
      hasCollection,
      startFailed: startProblem !== null,
    });

  const {active: collectionMode, dead} = mode;
  useEffect(() => {
    if (dead) leaveBinder();
  }, [dead, leaveBinder]);
  const friendView = useFriendView(collectionMode ? friendHandle : null, user?.id ?? null, leaveFriend);
  const {friend} = friendView;
  // A start's problem is about the reader's own binder, never a friend's.
  const ownProblem = friend === null ? startProblem : null;
  const show = shownOf(asked, friendView.compare);
  const location = useLocation();

  // Only collection mode (or the import, which parses against the full pool)
  // widens the pool, so a visitor who never switches fetches no chunks at all.
  const {pool: wholePool, waiting, error, isReady} = useCollectionPool(coreCards, collectionMode || showImport);
  // Your own binders, read once collection mode opens your binder, and the one `?custom=` names.
  const own = useOwnBinders(
    binderAsk({uid: user?.id ?? null, hasCollection, syncing, collectionMode, friendHandle, customId}),
    wholePool,
    entries,
  );
  const {custom, pool} = own;
  // The shelf while `?binder=shelf` shows, or for a player with nothing on it, My collection's
  // empty start in its place (4B).
  const shelfSlot = useShelfOf({on: collectionMode && onShelf, syncing, holdsCopies, shelf: own.shelf}, shelfToBinder);
  const binderWindow = useWindowOf({readerId: user?.id ?? null, pool: isReady ? wholePool : null, entries});
  // A binder of your own's sets are unknown until the shelf answers: the request is trusted till then.
  const sets = binderSetsNow(pool, isReady, custom);
  const setCode = resolveSetCode(requested, sets);
  // What the panel's headlines count, Complete or Master, which Owned and Missing ask too
  // (owner, 2026-10-20): held here rather than in the panel, so the binder's view can ask it.
  const [axis, setAxis] = useState<Axis>('complete');

  // The cards changed by hand in this view of the binder, which its Owned and Missing views
  // keep: a view is the mode, whose binder, the set, Owned or Missing, the headline they ask
  // of, and the sort (`useKeptCards`).
  const [searchParams] = useSearchParams();
  const view = [
    collectionMode,
    friend === null ? '' : friendHandle,
    customId ?? '',
    setCode,
    show,
    axis,
    searchParams.get(SORT_PARAM),
  ].join('|');
  const {kept, changeCount, noteWindowEdit} = useHandCounts(
    {collectionMode, friend: friend !== null, view},
    {entries, setCount},
  );

  // Where the open import was asked for, which its events report.
  const [importSurface, setImportSurface] = useState<ImportSurface>('browse');
  const openImport = (surface: ImportSurface) => {
    trackEvent('collection_import_opened', {surface, replacing: holdsCopies});
    setImportSurface(surface);
    setImportMounted(true);
    setShowImport(true);
  };
  // Only the switch's own on and off count as toggles: a click that opens sign-in sends
  // nothing here, and an import that lands in the binder is collection_imported.
  const toggles = useModeToggleEvents(syncing, hasCollection);
  // Collection lands on the shelf, where binders are on, unless a Set filter names a set: then
  // My collection at that set (`enterBinder`).
  const enterMode = () => {
    toggles.entered();
    enterBinder(SHOW_BINDERS ? SHELF : setCode, sets);
  };
  // Backing out of a binder still waiting on the account withdraws its start, as the click
  // that asked for it is withdrawn (`useModeToggleEvents`).
  const leaveMode = () => {
    cancelStart();
    toggles.left();
    leaveBinder();
  };
  // Sign-in first, then the binder, started empty for a reader with no collection: the order is
  // the rule and lives in `collectionAction`, pure and tested, since its branches need a session.
  const onCollectionClick = () =>
    collectionClick(
      {signedIn: user !== null, hasCollection, active: collectionMode},
      {openSignIn: () => setShowSignIn(true), start: () => startCollection('browse'), enter: enterMode, leave: leaveMode},
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
      <CollectionActions
        onImport={() => openImport('browse')}
        checking={syncing && !hasCollection}
        onMenuOpen={preloadImportDialog}
      />
    ) : null;

  const panelControls = {
    setCode,
    sets: panelSets(sets, setCode),
    setsLoading: sets === null,
    picksPromos: rarityPicksPromos(searchParams),
    binders: binderChoicesOf(
      own,
      {friend, setCode, entries, pool: isReady ? wholePool : null},
      {onOpen: openBinder, onShelf: openShelf, onNewBinder: newBinderFrom(binderWindow, openBinder)},
    ),
    show,
    axis,
    ...trackedPicks(
      {onSetChange: writeBinder, onShowChange: writeShow, onAxisChange: setAxis},
      {setCode, show, axis, friend: friend !== null},
    ),
  };
  // You need and They need, counted over the scope's cards the page lets through, as the
  // panel's numbers are; null outside a friend's binder, or for a reader with no collection.
  const compareFor = (listing: BrowseListing): CompareCounts | null =>
    friendView.compare &&
    countScopeOnce({cards: listing.matched, setCode, sets: panelControls.sets}, friendView.compare, ownsAxis(setCode, axis));
  // What the docked panel and the set pickers count: the cards the page lets through. Only the
  // docked panel draws the reader's own "You" lines, so it alone is handed their copies.
  // The reader's own binder waits on the account's copy, and a binder of your own on the shelf too.
  const ownWaiting = waitsOnYours(syncing, custom);
  const setCounts = (listing: BrowseListing) => ({
    cards: listing.matched,
    filtered: listing.filtered,
    entries: friendView.shown,
    isLoading: (friend === null ? ownWaiting : friendView.waiting) || !isReady,
  });
  // No panel and no picker beside a binder that isn't there: a friend's, one whose start made no
  // collection, or a binder of your own that isn't on your shelf or didn't load.
  // Nor beside the shelf, which shows binders rather than a binder's cards.
  const binderShows = collectionMode && shelfSlot === null && binderIsDrawn({friend, custom, problem: ownProblem});
  // Save as a binder, in the reader's own binders alone, once the cards are in.
  const saveAsBinder = useSaveOf({
    readerId: user !== null && hasCollection && friend === null && binderShows && isReady ? user.id : null,
    offerOf: own.offerOf,
    scope: setCode,
    openWindow: binderWindow.open,
    openBinder,
  });

  // Friends who have a card for the reader, for a reader with a collection. Their badges and the
  // foil pointer show in the reader's own binder only.
  const friendsHave = user !== null && hasCollection;
  const ownFriends = friendsHave && friend === null;
  const pocketBadge = ownFriends
    ? (card: LorcanaCard) => (
        <Suspense fallback={null}>
          <PocketFriends card={card} axis={ownsAxis(setCode, axis)} />
        </Suspense>
      )
    : undefined;
  // The foil pointer's button: Master set, under which the binder shows the foils friends have.
  const showFoilsOnOffer = () => {
    trackViewPick('foil_pointer', {value: 'master', was: axis}, false);
    setAxis('master');
  };
  const renderFoilPointer = ownFriends
    ? (cards: readonly LorcanaCard[]) => (
        <Suspense fallback={null}>
          <FoilPointer cards={cards} onShow={showFoilsOnOffer} />
        </Suspense>
      )
    : undefined;

  // Loading while the account's copy is still to answer, or the shelf My collection's size, or a
  // friend's binder. Until the shelf answers, the loading binder draws the size this browser
  // remembers for My collection, else a new binder's.
  const remembered = user === null ? null : rememberedOf(user.id);
  const grid = binderGridOf(own, friend, remembered);
  const binderLoading = (friend === null ? ownWaiting || grid === null : friendView.waiting) || (!isReady && error === null);
  const drawnGrid = grid ?? squarePage(remembered ?? DEFAULT_SIDE);
  const ownStatus = customStatusOf(custom, ownStatusOf({error, onRetry: retry}, ownProblem, () => startCollection('browse')));
  const binderStatus = binderStatusOf(friend, ownStatus);

  function renderShelf() {
    if (!BinderShelf || !own.shelf) return null;
    return (
      <Suspense key="shelf" fallback={null}>
        <BinderShelf
          shelf={own.shelf}
          pool={isReady ? wholePool : null}
          entries={entries}
          waiting={syncing || user === null}
          readerId={user?.id ?? ''}
          onWindow={binderWindow.open}
        />
      </Suspense>
    );
  }

  function renderBinderSection(listing: BrowseListing, onCardSelect: (card: LorcanaCard, source: BinderCardSource) => void) {
    return (
      <Suspense key="binder" fallback={<BinderChunkFallback grid={drawnGrid} />}>
        <CollectionBinderSection
          cards={pool}
          grid={drawnGrid}
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
          onCardSelect={(card) => onCardSelect(card, binderSourceOf(friend))}
          // A friend's binder is read only: no − and + in its pockets.
          onCountChange={friend === null ? changeCount : undefined}
          startAt={friend === null ? undefined : startAtOf(location)}
          pocketBadge={pocketBadge}
          renderFoilPointer={renderFoilPointer}
          onEmptyImport={emptyImportOf(friend, {hasCollection, holdsCopies}, () => openImport('empty_binder'))}
        />
      </Suspense>
    );
  }

  function renderBinder(listing: BrowseListing, onCardSelect: (card: LorcanaCard, source: BinderCardSource) => void) {
    if (!collectionMode) return null;
    // Each view its own boundary (`key`), so a cover's press, a navigation and so a transition,
    // shows the binder's frame at once rather than holding the shelf while the binder's code loads.
    if (shelfSlot) return renderShelf();
    if (friend?.status === 'not-sharing') return <FriendNotSharing name={friend.name} handle={friend.handle} />;
    if (custom.status === 'unknown' && UnknownBinder) {
      return (
        <Suspense key="unknown" fallback={null}>
          <UnknownBinder onToShelf={openShelf} />
        </Suspense>
      );
    }
    return renderBinderSection(listing, onCardSelect);
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
      {binderWindow.node}
      {saveAsBinder.node}
      {importMounted && (
        <Suspense fallback={null}>
          <ImportCollectionDialog
            isOpen={showImport}
            onClose={() => setShowImport(false)}
            // The whole pool, inside a binder of your own too: an import is the whole collection.
            pool={wholePool}
            // Blocks a parse against an incomplete pool: that parse does not fail,
            // it silently drops the cards it cannot see.
            isPoolReady={isReady}
            // Outside collection mode the binder, which shows this error too, is not drawn.
            poolError={error}
            onRetryPool={retry}
            context={{surface: importSurface, replacing: holdsCopies}}
            // Land in collection mode on success, from the gear on the grid too: the
            // import is the reader's collection. Only on success, or a refused write
            // would show the binder as if it had worked.
            onImport={(imported, at) => {
              const storageError = importCollection(imported, at);
              if (storageError === null) enterBinder(setCode, sets);
              return storageError;
            }}
          />
        </Suspense>
      )}
      {/* The card window keeps your own copies, in a friend's binder too. */}
      <WindowCopies onEdit={noteWindowEdit} />
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
    shelf: shelfSlot && Heading ? {heading: <Heading count={shelfSlot.count} />} : null,
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
    pickerNamesBinder: binderShows && namesOwnBinder(panelControls.binders),
    renderSetPicker: (listing) =>
      binderShows ? (
        <Suspense fallback={<ToolbarSetPickerFallback />}>
          <DockedSetPicker {...setCounts(listing)} {...panelControls} />
        </Suspense>
      ) : undefined,
    renderPhoneRow: (listing, {count, onOpen}) =>
      shelfSlot && Heading ? (
        <PhoneShelfRow heading={<Heading count={shelfSlot.count} compact />} modeSwitch={modeSwitch} />
      ) : binderShows ? (
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
      binderShows ? (
        <BinderSheet {...sheet} show={show} compare={compareFor(listing)} friend={friend !== null} />
      ) : undefined,
    renderBanner,
    renderSaveAsBinder: saveAsBinder.render,
  };
}
