import {useEffect} from 'react';
import {useSearchParamsWriter} from '../../shared/hooks/useSearchParamsWriter';
import {SET_PARAM} from '../../shared/hooks/useFilterParams';
import {SET_NAMES} from '../../shared/constants';
import {
  ALL_PROMO_SETS,
  BINDER_PARAM,
  COMPARE_SHOWS,
  CUSTOM_PARAM,
  FRIEND_PARAM,
  OWNED_PARAM,
  SHELF,
  WHOLE_COLLECTION,
  isPromoSet,
  isShelf,
  openBinderParams,
  parseBinderShow,
  setFromFilter,
  shelfParams,
  spansSets,
  strayParams,
  withoutStrays,
  writeShowParam,
  type BinderShow,
} from './binderCards';

/**
 * The NEWEST set, where a set the binder does not have falls back to while the pool
 * loads (`resolveSetCode`). Taken from `SET_NAMES` rather than the pool, which the
 * first click on Collection comes BEFORE (the toggle is what loads it), and a new set
 * cannot ship without its entry there (`SetCode` enforces it).
 */
const DEFAULT_SET = String(Math.max(...Object.keys(SET_NAMES).map(Number)));

/**
 * Whether a request shows the whole collection: none, the whole collection, or the shelf, which
 * shows no set, so what it hands on (an import landing in the binder) is My collection's.
 */
const showsWholeCollection = (requested: string | null): requested is null | typeof WHOLE_COLLECTION | typeof SHELF =>
  requested === null || requested === WHOLE_COLLECTION || isShelf(requested);

/**
 * The set to show, the whole collection, or every promo set. Collection mode opens on
 * the whole collection (owner, 2026-10-20; the newest set before), unless a Browse set
 * filter names one (`setFromFilter`). A set the binder does not have (`?binder=99`)
 * falls back to the newest it does, rather than drawing an empty binder under a picker
 * naming a different set, and every promo set (`?binder=promos`) in a binder with none
 * to the whole collection. Until the list is known the request is trusted: nothing
 * contradicts it yet.
 */
export function resolveSetCode(requested: string | null, sets: string[] | null): string {
  if (showsWholeCollection(requested)) return WHOLE_COLLECTION;
  if (requested === ALL_PROMO_SETS) return promoScopeIn(sets);
  if (!listKnown(sets) || sets.includes(requested)) return requested;
  return sets[0] ?? DEFAULT_SET;
}

/**
 * Whether the binder's list of sets is known and holds any. A binder of your own whose rules hold
 * no card has none, so it has no set to fall back to: it stays where it was asked.
 */
const listKnown = (sets: string[] | null): sets is string[] => sets !== null && sets.length > 0;

/** Every promo set, unless the binder's sets are known and hold none: then the whole collection. */
const promoScopeIn = (sets: string[] | null) =>
  !listKnown(sets) || sets.some(isPromoSet) ? ALL_PROMO_SETS : WHOLE_COLLECTION;

/**
 * The panel's list of sets: the real one once known, else just the current set, so the
 * panel's height never changes when the list arrives; none for a scope spanning sets. A binder
 * of your own whose rules hold no card has no set, so its one set is counted, as empty.
 */
export function panelSets(sets: string[] | null, setCode: string): string[] {
  if (listKnown(sets)) return sets;
  return spansSets(setCode) ? [] : [setCode];
}

/** Who is asking for collection mode, and what is known about them yet. */
export interface BinderReader {
  sessionLoading: boolean;
  /** The account's copy has not answered yet (`useCollection().syncing`). */
  syncing: boolean;
  signedIn: boolean;
  hasCollection: boolean;
  /** The reader's start made no collection, and the binder says why (`useCollection().startProblem`). */
  startFailed: boolean;
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
 * click that waited on the account leaves one behind (#553). A start that made no collection
 * keeps it instead: the binder the reader opened says why, with a Try again.
 *
 * `strayParams` reads the param, not the mode, so the page drops its strays only once the
 * param is known to be honoured (#790). Signed out, `?binder=` keeps the grid, and the
 * grid keeps a Set filter picked on it. Nor does the filter go while a stored session
 * restores: that reader may yet turn out signed out, or holding no collection.
 */
function binderMode(requested: string | null, reader: BinderReader, friend: boolean): BinderMode {
  if (requested === null) return {active: false, dead: false, dropsStrays: true};
  return friend ? friendBinderMode(reader) : ownBinderMode(reader);
}

/** Someone the Collection button would toggle for: signed in, holding a collection or a start that says why it made none. */
const takesBinder = (reader: BinderReader) => reader.signedIn && (reader.hasCollection || reader.startFailed);

/** What `?binder=` gets in the reader's own binders (`binderMode`). */
function ownBinderMode(reader: BinderReader): BinderMode {
  const pending = reader.sessionLoading || reader.syncing;
  const honoured = !pending && takesBinder(reader);
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

/**
 * Whose binder the params name: the shelf, a friend's (by handle), or one of your own. A friend
 * outside the binder or on the shelf is a stray, and so is a binder of your own in either place.
 */
function whoseBinder(params: URLSearchParams, requested: string | null) {
  const onShelf = isShelf(requested);
  if (onShelf) return {onShelf, friend: null, custom: null};
  const friend = requested === null ? null : params.get(FRIEND_PARAM);
  return {onShelf, friend, custom: friend === null ? params.get(CUSTOM_PARAM) : null};
}

/** Whether a view is one only a friend's binder has: You need or They need. */
export const comparesWith = (raw: string | null) => COMPARE_SHOWS.some((show) => show === raw);

/**
 * Collection mode's params: `?binder=` (the mode and its set) and `?owned=` (what the
 * binder shows), and what the reader gets of the mode (`binderMode`). Every write edits
 * the params rather than replacing them, so the page's filters ride along. A write starts
 * from the page's last write until that write renders (`useSearchParamsWriter`), so writes
 * made before a render all land, this hook's and useFilterParams' alike.
 *
 * THE SET IS CHOSEN IN THE COLLECTION PANEL (owner, 2026-10-12), so collection mode
 * keeps no set FILTER: entering it opens the set a Browse set filter names (the newest,
 * if several) and drops the filter, and a link that carries one into the mode loses it.
 * Leaving drops the binder view, which the grid has no collection for; a link that
 * carries one outside the mode loses it too. See `strayParams`.
 */
export function useBinderParams(reader: BinderReader) {
  const [searchParams, write] = useSearchParamsWriter();
  const requested = searchParams.get(BINDER_PARAM);
  const {onShelf, friend, custom} = whoseBinder(searchParams, requested);
  const mode = binderMode(requested, reader, friend !== null);
  const hasStrays = mode.dropsStrays && strayParams(searchParams).length > 0;
  useEffect(() => {
    if (!hasStrays) return;
    write(withoutStrays);
  }, [hasStrays, write]);

  return {
    requested,
    friend,
    onShelf,
    custom,
    mode,
    // You need and They need ask of the reader's own collection too, so only a reader with one
    // (or whose account has yet to answer) gets them.
    show: parseBinderShow(searchParams.get(OWNED_PARAM), friend !== null && (reader.hasCollection || reader.syncing)),
    enterBinder: (fallback: string, sets: string[] | null) =>
      write((next) => {
        next.set(BINDER_PARAM, setFromFilter(next.get(SET_PARAM), sets) ?? fallback);
        next.delete(SET_PARAM);
      }),
    writeBinder: (set: string) => write((next) => next.set(BINDER_PARAM, set)),
    openBinder: (binder: {id: string; scope: string} | null) => write((next) => openBinderParams(next, binder)),
    // A push, so Back returns to the binder it was opened from.
    openShelf: () => write(shelfParams, {replace: false}),
    // The shelf of a player with nothing on it (4B): today's empty start in its place.
    shelfToBinder: () => write((next) => next.set(BINDER_PARAM, WHOLE_COLLECTION)),
    // Out of the mode, the binder's view is a stray: gone in the same write.
    leaveBinder: () =>
      write((next) => {
        next.delete(BINDER_PARAM);
        return withoutStrays(next);
      }),
    writeShow: (show: BinderShow) => write((next) => writeShowParam(next, show)),
    // Back to the reader's own binder at the same scope: the views only a friend's has go too.
    leaveFriend: () =>
      write((next) => {
        next.delete(FRIEND_PARAM);
        if (comparesWith(next.get(OWNED_PARAM))) next.delete(OWNED_PARAM);
      }),
  };
}
