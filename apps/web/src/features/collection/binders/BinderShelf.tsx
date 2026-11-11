import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {useLocation, useNavigate} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CtaButton} from '../../../shared/components';
import {useResponsive} from '../../../shared/hooks';
import {trackEvent} from '../../../shared/lib/analytics';
import {COLORS, FONT_SIZES, SPACING} from '../../../shared/constants';
import {BROWSE_GUTTER, browseRowTop} from '../../cards/components/BrowseSidePanel';
import {DEFAULT_SIDE, type PageSide} from '../../cards/components/binderGeometry';
import {isPromoScope, openBinderParams} from '../binderCards';
import type {CollectionEntries} from '../collectionParser';
import {BinderCover, CoverSkeleton} from './BinderCover';
import {BinderMenu} from './BinderMenu';
import {binderFace, type BinderFace} from './binderCovers';
import {ruleKinds, ruleLine, type Binder} from './binderRules';
import {deleteBinder, moveBinder, type BinderShelf as Shelf} from './binderShelf';
import {DeleteBinderDialog} from './DeleteBinderDialog';
import {NewBinderTile, ShelfFullLine} from './NewBinderTile';
import {MY_COLLECTION, SHELF_MAX} from './shelfWords';
import type {WindowAsk} from './useBinderWindow';
import {useShelfChanges} from './useShelfChanges';

export interface BinderShelfProps {
  /** Your binders in place order, and whether they have loaded. */
  shelf: Shelf;
  /** What each cover counts: the whole pool, null while it loads. */
  pool: readonly LorcanaCard[] | null;
  entries: CollectionEntries;
  /** The account's copy has yet to answer: the covers wait for it. */
  waiting: boolean;
  /** Whose shelf: each change waits in their write queue. */
  readerId: string;
  /** Opens the New binder window, for New binder and Edit rules; null until the cards are in. */
  onWindow: ((ask: WindowAsk) => void) | null;
}

/** As many covers across as fit at 180 px or more on a computer (six at 1440 px); two on a phone. */
function gridStyle(isMobile: boolean): CSSProperties {
  const sides = isMobile ? SPACING.lg : BROWSE_GUTTER;
  return {
    display: 'grid',
    gridTemplateColumns: isMobile ? 'repeat(2, minmax(0, 1fr))' : 'repeat(auto-fill, minmax(180px, 1fr))',
    columnGap: isMobile ? SPACING.md : SPACING.xxxl,
    rowGap: isMobile ? SPACING.xl : SPACING.xxxl,
    margin: 0,
    padding: `${browseRowTop(isMobile)}px ${sides}px ${SPACING.xxl}px`,
    listStyle: 'none',
  };
}

const FAILED_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  justifyContent: 'center',
  gap: SPACING.md,
  color: COLORS.textMuted,
  fontSize: `${FONT_SIZES.lg}px`,
};

/** The address that opens a binder, or My collection (null), from the shelf's own. */
function binderHref(pathname: string, search: string, binder: Binder | null): string {
  return `${pathname}?${openBinderParams(new URLSearchParams(search), binder).toString()}`;
}

/** What a cover says, and whether it counts promos: My collection's words, or a binder's own. */
function wordsOf(binder: Binder | null) {
  if (binder === null) return {name: MY_COLLECTION, rule: 'Every card', promos: false};
  return {name: binder.name, rule: ruleLine(binder), promos: isPromoScope(binder.scope)};
}

/** What the shelf holds once it has loaded: the binders, and the cover My collection's row names. */
interface ShelfHeld {
  binders: readonly Binder[];
  myCover: string | null;
  myPages: PageSide;
}

const NOTHING_HELD: ShelfHeld = {binders: [], myCover: null, myPages: DEFAULT_SIDE};

function heldOf(shelf: Shelf): ShelfHeld {
  if (shelf.status !== 'ready') return NOTHING_HELD;
  const look = shelf.myCollection;
  return {binders: shelf.binders, myCover: look?.cover ?? null, myPages: look?.pages ?? DEFAULT_SIDE};
}

/** Whether the binders have answered: read, or failed, which leaves My collection alone. */
const answered = (shelf: Shelf) => shelf.status === 'ready' || shelf.status === 'failed';

/**
 * Each cover's face, My collection's under null, or null until the counts are in. Every binder's
 * rules run over the whole pool, so they are worked out once for the pool, the copies and the
 * shelf, never again for the confirm or a failed move's line.
 *
 * A hook of its own, since in the shelf's body the compiler memoizes them with the covers, whose
 * memo the confirm and the moves break. `'use memo'` opts it in: the compiler infers a hook only
 * from the hooks it calls, and this one calls none.
 */
function useFaces(pool: readonly LorcanaCard[] | null, entries: CollectionEntries, {binders, myCover}: ShelfHeld) {
  'use memo';
  if (pool === null) return null;
  const faces = new Map<string | null, BinderFace>([[null, binderFace(pool, entries, null, myCover)]]);
  for (const binder of binders) faces.set(binder.id, binderFace(pool, entries, binder));
  return faces;
}

/** `binder_opened` from the shelf: the kinds of its rules, never its name or id. */
const trackOpened = (binder: Binder | null) =>
  trackEvent('binder_opened', {from: 'shelf', mine: binder !== null, kinds: binder ? ruleKinds(binder) : 'none'});

/** Where focus goes once a change lands: a moved binder's ⋯, or after a delete a cover (null: My collection's). */
interface FocusAsk {
  id: string | null;
  part: 'cover' | 'actions';
}

/** The binder Delete binder asked about, kept while the confirm closes so its words stay. */
interface DeleteAsk {
  binder: Binder;
  open: boolean;
  deleting: boolean;
  failed: boolean;
}

/** After a delete, the cover after it, else the one before (My collection's at worst). */
function neighbourOf(binders: readonly Binder[], id: string): string | null {
  const at = binders.findIndex((binder) => binder.id === id);
  return binders[at + 1]?.id ?? binders[at - 1]?.id ?? null;
}

/**
 * The covers' elements by binder, held in memory so no id reaches an attribute: what a change
 * hands focus to once it lands (`FocusAsk`). Focus moves in an effect, after the shelf has drawn
 * the change: a move can take the focused ⋯ out of the page and back as React reorders it.
 */
function useFocusAfter() {
  const covers = useRef(new Map<string | null, HTMLAnchorElement>());
  const actions = useRef(new Map<string, HTMLButtonElement>());
  const [ask, setAsk] = useState<FocusAsk | null>(null);
  useEffect(() => {
    if (ask === null) return;
    const target = ask.part === 'actions' && ask.id !== null ? actions.current.get(ask.id) : covers.current.get(ask.id);
    target?.focus();
  }, [ask]);
  /** A callback ref that files an element under its binder while it is in the page. */
  const holder =
    <K, E>(map: Map<K, E>, key: K) =>
    (node: E | null) => {
      if (node === null) return;
      map.set(key, node);
      return () => {
        if (map.get(key) === node) map.delete(key);
      };
    };
  return {
    coverRef: (id: string | null) => holder(covers.current, id),
    actionsRef: (id: string) => holder(actions.current, id),
    focusOn: (next: FocusAsk) => setAsk(next),
  };
}

/** Move earlier and later, the line a failed one leaves under its cover, and focus on its ⋯ once it lands. */
function useMoves(readerId: string, focusOn: (ask: FocusAsk) => void) {
  const [failedId, setFailedId] = useState<string | null>(null);
  const move = async (binder: Binder, earlier: boolean) => {
    setFailedId(null);
    const result = await moveBinder({readerId, id: binder.id, earlier});
    if (result === 'failed') {
      setFailedId(binder.id);
      return;
    }
    if (result !== 'moved') return;
    trackEvent('binder_changed', {what: 'place'});
    focusOn({id: binder.id, part: 'actions'});
  };
  return {failedId, move};
}

/** Delete binder's confirm, and the delete once it is confirmed. */
function useDeletes(readerId: string, binders: readonly Binder[], focusOn: (ask: FocusAsk) => void) {
  const [ask, setAsk] = useState<DeleteAsk | null>(null);
  const confirm = async () => {
    if (ask === null) return;
    const {binder} = ask;
    const next = neighbourOf(binders, binder.id);
    setAsk({...ask, deleting: true, failed: false});
    const deleted = await deleteBinder({readerId, id: binder.id});
    if (!deleted) {
      setAsk({...ask, deleting: false, failed: true});
      return;
    }
    trackEvent('binder_deleted', {kinds: ruleKinds(binder)});
    setAsk({...ask, open: false, deleting: false, failed: false});
    focusOn({id: next, part: 'cover'});
  };
  return {
    ask,
    open: (binder: Binder) => setAsk({binder, open: true, deleting: false, failed: false}),
    close: () => setAsk((now) => (now === null ? now : {...now, open: false, failed: false})),
    confirm,
  };
}

/** A binder of your own's ⋯ items beyond Open and Change cover: what the shelf can do to it. */
interface OwnActs {
  editRules: ((binder: Binder) => void) | undefined;
  rename: (binder: Binder) => void;
  move: (binder: Binder, earlier: boolean) => void;
  remove: (binder: Binder) => void;
}

/** The ⋯ props a binder of your own adds, at `index` of `count` on the shelf. */
function ownMenu(binder: Binder, {index, count}: {index: number; count: number}, acts: OwnActs) {
  const {editRules} = acts;
  return {
    onEditRules: editRules && (() => editRules(binder)),
    onRename: () => acts.rename(binder),
    moves: {first: index === 0, last: index === count - 1, onMove: (earlier: boolean) => acts.move(binder, earlier)},
    onDelete: () => acts.remove(binder),
  };
}

/**
 * The binder shelf: My collection's cover, then each binder of your own in place order, each a
 * link that opens it as a push, so Back returns here. Each cover carries a ⋯ (`BinderMenu`):
 * Open and Change cover on My collection's, and on your binders Edit rules, Rename, the moves
 * and Delete binder too. The shelf's heading and count stand in the toolbar, or a phone's binder
 * row (`ShelfHeading`).
 *
 * While the cards, the account's copy or the binders load, each cover still to come is a
 * shimmer its size, My collection's from the start, so nothing moves as they land. A failed read
 * leaves My collection, and a line with its Try again.
 *
 * Lazy, in a chunk of its own, and only with binders on (`flag.ts`). The whole shelf carries
 * `ph-no-capture`: its covers show the player's own names.
 */
export function BinderShelf({shelf, pool, entries, waiting, readerId, onWindow}: BinderShelfProps) {
  const {isMobile} = useResponsive();
  const navigate = useNavigate();
  const {pathname, search} = useLocation();
  const focus = useFocusAfter();
  const moves = useMoves(readerId, focus.focusOn);
  const held = heldOf(shelf);
  const {binders} = held;
  const deletes = useDeletes(readerId, binders, focus.focusOn);
  // Nothing is counted until the cards, the account's copy and the binders are in.
  const counted = waiting || !answered(shelf) ? null : pool;
  const faces = useFaces(counted, entries, held);
  const changes = useShelfChanges({readerId, isMobile, counted: counted !== null, myCover: held.myCover, myPages: held.myPages});
  const acts: OwnActs = {
    editRules: onWindow
      ? (binder) => onWindow({binder, onSaved: (saved) => focus.focusOn({id: saved.id, part: 'actions'})})
      : undefined,
    rename: changes.rename,
    move: (binder, earlier) => void moves.move(binder, earlier),
    remove: deletes.open,
  };

  const menu = (binder: Binder | null, index: number, to: string) => (
    <BinderMenu
      alwaysShown={isMobile}
      onOpen={() => {
        trackOpened(binder);
        void navigate(to);
      }}
      // Only once the shelf is read: after a failed read My collection's cover has nowhere to show.
      onChangeCover={shelf.status === 'ready' ? () => changes.changeCover(binder) : undefined}
      onChangePages={shelf.status === 'ready' && binder === null ? changes.changePages : undefined}
      {...(binder && ownMenu(binder, {index, count: binders.length}, acts))}
      buttonRef={binder ? focus.actionsRef(binder.id) : undefined}
    />
  );

  const cover = (binder: Binder | null, index: number) => {
    const id = binder?.id ?? null;
    const face = faces?.get(id);
    if (face === undefined) return <CoverSkeleton />;
    const to = binderHref(pathname, search, binder);
    return (
      <BinderCover
        {...wordsOf(binder)}
        cover={face.cover}
        figures={face.figures}
        to={to}
        onOpen={() => trackOpened(binder)}
        compact={isMobile}
        linkRef={focus.coverRef(id)}
        note={binder !== null && moves.failedId === binder.id ? "Couldn't move it. Try again." : null}
        actions={menu(binder, index, to)}
      />
    );
  };

  return (
    <div className="ph-no-capture" style={{height: '100%', overflowY: 'auto'}}>
      <ul aria-label="Your binders" style={gridStyle(isMobile)}>
        <li>{cover(null, -1)}</li>
        {binders.map((binder, index) => (
          <li key={binder.id}>{cover(binder, index)}</li>
        ))}
        {onWindow && faces !== null && shelf.status === 'ready' && (
          <li>
            {binders.length >= SHELF_MAX ? (
              <ShelfFullLine />
            ) : (
              <NewBinderTile
                compact={isMobile}
                onNew={() => onWindow({binder: null, onSaved: (saved) => focus.focusOn({id: saved.id, part: 'cover'})})}
              />
            )}
          </li>
        )}
        {shelf.status === 'failed' && (
          <li style={FAILED_STYLE}>
            <span role="status">Couldn&apos;t load your binders.</span>
            <CtaButton variant="ghost" onClick={shelf.retry}>
              Try again
            </CtaButton>
          </li>
        )}
      </ul>
      {deletes.ask && (
        <DeleteBinderDialog
          isOpen={deletes.ask.open}
          name={deletes.ask.binder.name}
          isMobile={isMobile}
          deleting={deletes.ask.deleting}
          failed={deletes.ask.failed}
          onConfirm={() => void deletes.confirm()}
          onClose={deletes.close}
        />
      )}
      {changes.node}
    </div>
  );
}
