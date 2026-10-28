import {
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type ComponentProps,
  type ReactNode,
  type Ref,
} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries, CollectionEntry, Finish} from './collectionParser';
import type {CollectionPromo} from './collectionPromos';
import {CollectionBinder} from './CollectionBinder';
import {
  ALL_PROMO_SETS,
  WHOLE_COLLECTION,
  binderContents,
  binderSlots,
  namesStretches,
  slotKey,
  type BinderShow,
} from './binderCards';
import {tallyCollection, type Axis} from './collectionStats';
import {sectionStyle} from './binderLayout';
import {useLoneFit} from './useLoneFit';
import {
  CollectionSetBody,
  CollectionSetRail,
  CoverNumbers,
  RowSetPicker,
  ToolbarSetPicker,
  type AxisChoice,
  type CollectionSetPanelProps,
  type SetSwitching,
} from './CollectionSetPanel';
import type {BinderView} from './BinderShows';
import {useSidePanelDocked} from '../cards/components/BrowseSidePanel';
import {BinderSpread, BinderSlotSkeleton} from '../cards/components/BinderSpread';
import {PER_PAGE, pagingOf, type LoneFit} from '../cards/components/binderGeometry';
import {BinderSpreadMap, type Pocket} from '../cards/components/BinderSpreadMap';
import {CtaButton} from '../../shared/components';
import {CardWindowSlotContext} from '../../shared/contexts/cardWindowSlot';
import {useResponsive} from 'inkweave-ui/hooks/useResponsive';
import {COLORS, FONT_SIZES, SPACING, type BrowseSortOrder} from '../../shared/constants';

/**
 * Collection mode's content: the set panel, and that set's binder.
 *
 * THE SET IS CHOSEN IN THE SET PICKER, through the `?binder=` param, and only there: the
 * filters panel drops its Set section in collection mode. On desktop it sits in the
 * toolbar beside Collection (owner, 2026-10-20; `DockedSetPicker`), on tablets in the
 * collection panel's rail (owner, 2026-10-12; a picker under the set's logo before), and
 * on phones at the head of the binder's row (owner, 2026-10-25, #969; `PhoneSetPicker`).
 * See `CollectionSetPanel`.
 *
 * THE PANEL ADAPTS (owner, 2026-10-07): on desktop it is docked on the binder's
 * right, under the Collection button (owner, 2026-10-08; it was a tab beside the
 * filters before), and the PAGE renders it (see `DockedSetBody`), so this section
 * draws only the binder; on tablets, where nothing docks, a collapsible rail. On phones
 * the binder has the section to itself (owner, 2026-10-25, #969): the page draws the
 * set picker in the row above it, in place of Browse's title, toolbar and the set strip
 * that sat here.
 *
 * THE BINDER HOLDS WHAT THE PAGE LISTS: the set's cards that pass its filters (owner,
 * 2026-10-12; they used to dim in place), in its sort (owner, 2026-10-08), packed pocket
 * by pocket. The default sort is collector order within a set, so an unfiltered binder
 * opens laid out like a real one; see `binderOrder`.
 *
 * THE PANEL'S NUMBERS FOLLOW THE FILTERS (owner, 2026-10-15; they stayed the whole
 * set's before): with a search or a filter on, every number counts only the cards it
 * lets through, the set picker's percentages too. They count before the binder's
 * Owned / Missing view, which would otherwise make Owned read 100%.
 *
 * OR THE WHOLE COLLECTION (owner, 2026-10-12), picked first in the set picker: set by
 * set in collector order, each set continuing where the one before ends, or one list
 * across every set in any other sort. See `binderContents`.
 *
 * WHERE THE PAGE DOCKS ITS PANELS, THE SPREAD MAP TURNS THE PAGES (owner, 2026-10-12),
 * in the band under the spread, AND ON A PHONE A MAP OF PAGES DOES (owner, 2026-10-25,
 * #969), under the lone page in its arrows' place; see `BinderSpreadMap`.
 *
 * COUNTS CHANGE WHERE A MOUSE POINTS (#826): a spread's pocket opens its copies stripe
 * (`CollectionSlotCounts`), and the card window's stripe changes them too (`WindowCopies`).
 * A card changed by hand keeps its pocket in the Owned and Missing views until the view, the
 * set or the sort changes, or Browse closes (owner, 2026-10-20): dropped from the view
 * at once, it took the spread with it, since the binder reopens at its first spread
 * whenever what it holds changes. The page's listing keeps it (`useKeptCards`), so
 * `matchedIds` holds it.
 *
 * PHONES GET ONE PAGE PER VIEW (owner, 2026-10-07), decided here from the same
 * `useResponsive().isMobile` for the loading and loaded branches, so the skeleton
 * has the geometry of what replaces it.
 */

const ZERO: CollectionEntry = {normal: 0, foil: 0};

const NOOP = () => {};

/** No card window to watch: outside its provider, as in this section's tests and stories. */
const NO_WINDOW = {subscribe: () => NOOP, get: () => false};

/**
 * Whether the card window is open over the binder (#941), so a pocket whose copies change there
 * plays the change once it closes. From its open to its close, an expanded group and a desktop
 * comparison included, though those take away the slot under its card where the copies stripe
 * goes. A store, so this section alone re-renders as the window opens and closes, never the page
 * round it.
 */
function useCardWindowOpen(): boolean {
  const open = useContext(CardWindowSlotContext)?.open ?? NO_WINDOW;
  return useSyncExternalStore(open.subscribe, open.get, () => false);
}

/** What the page passes through to the collection panel: set switching, the binder view and the chosen headline. */
type PanelControls = SetSwitching & BinderView & AxisChoice;

/**
 * The set panel around the binder, where the page does not dock it: a rail beside the
 * binder on a tablet. A phone's binder sits in the section alone, the page's row above it
 * holding its set picker, and the section is what its page's rows fit (`section`).
 */
function PanelLayout({panel, section, children}: {
  panel: CollectionSetPanelProps;
  section: Ref<HTMLDivElement>;
  children: ReactNode;
}) {
  const {isMobile} = useResponsive();
  const docked = useSidePanelDocked();
  if (docked || isMobile) {
    return (
      <div ref={section} style={sectionStyle(isMobile, docked)}>
        {children}
      </div>
    );
  }
  return (
    <div style={sectionStyle(false)}>
      <div style={{display: 'flex', gap: SPACING.md, height: '100%', minHeight: 0}}>
        <CollectionSetRail {...panel} />
        <div style={{flex: 1, minWidth: 0, height: '100%'}}>{children}</div>
      </div>
    </div>
  );
}

interface CollectionBinderSectionProps extends PanelControls {
  /** The merged pool, Core plus collection. Filtered to one set here. */
  cards: LorcanaCard[];
  /** The promos whose card no dataset holds yet (#805): a promo set's binder names their pockets. */
  waiting?: readonly CollectionPromo[];
  /**
   * Ids passing the page's filters, from the same call Browse's grid uses: the binder
   * holds this set's cards among them. Membership rather than the filter options, so
   * the binder narrows exactly as the grid does by construction, not by two
   * implementations agreeing.
   */
  matchedIds: Set<string>;
  /**
   * The cards the panel counts: those the filters and search let through, before the
   * binder's Owned / Missing view (owner, 2026-10-15). See `BrowseListing.matched`.
   */
  counted: LorcanaCard[];
  /** Whether any filter or a search is on, so the panel says its numbers are filtered. */
  filtered: boolean;
  /** The page's sort: the order the binder's pockets fill in. */
  sortOrder: BrowseSortOrder;
  /** Owned copies per card id, split by finish: a friend's, in a friend's binder. */
  entries: CollectionEntries;
  /**
   * In a friend's binder, the reader's own copies, for the "You" lines under the friend's
   * headlines; absent for a reader with no collection, or in their own binder.
   */
  yourEntries?: CollectionEntries;
  /** The binder is a friend's, so its empty views speak of "their" collection. */
  friend?: boolean;
  /** True while the non-Core chunks are in flight. */
  isLoading: boolean;
  /** Set when they failed to load. */
  error: string | null;
  /** Ask for the chunks again after a failure. A user action, never automatic. */
  onRetry: () => void;
  onCardSelect: (card: LorcanaCard) => void;
  /** Change one finish's copies of a card from its pocket (#826); absent, counts are read-only. */
  onCountChange?: (cardId: string, finish: Finish, count: number) => void;
}

/**
 * The section's content, in a region that holds focus while the content changes under it.
 *
 * "TRY AGAIN" KEEPS FOCUS IN THE BINDER (#790): retrying swaps the error for the loading
 * binder, which unmounts the button that had focus, and focus fell to the page, so the
 * next Tab started from its top. The region takes focus first, and it stays mounted
 * through the loading binder and the loaded one, as `BrowseSidePanel`'s Clear all hands
 * focus to its panel. It is a group, not a landmark: the binder inside is the region.
 */
export function CollectionBinderSection({onRetry, ...props}: CollectionBinderSectionProps) {
  const regionRef = useRef<HTMLDivElement>(null);
  const retry = () => {
    regionRef.current?.focus();
    onRetry();
  };
  return (
    <div ref={regionRef} tabIndex={-1} role="group" aria-label="Collection" style={{height: '100%'}}>
      <SectionContent {...props} onRetry={retry} />
    </div>
  );
}

/**
 * A phone's loading map: the cover's mini and page 1's, empty, page 1 marked, as the loaded binder
 * opens. Its pockets are open ones, which draw as empty cells.
 */
const loadingPages = (loneFit: LoneFit): Pocket[] =>
  Array.from({length: pagingOf(true, loneFit.rows).perView}, () => ({owned: false, inks: [], open: true}));

/** The binder while its cards load: its chrome, as the loaded binder's, with shimmer in the pockets. */
function LoadingBinder({single, docked, loneFit}: {single: boolean; docked: boolean; loneFit: LoneFit}) {
  return (
    <BinderSpread
      // Spreads open on the front cover, as the binder does (owner, 2026-10-18); a phone on page 1,
      // past its cover.
      start={single ? 0 : -PER_PAGE}
      single={single}
      loneFit={loneFit}
      arrows={docked ? 'edges' : 'beside'}
      // Docked, or on a phone, a map of one empty spread or page holds the band the real map
      // will fill. It holds no cards yet, so it is out of the Tab order and the accessibility
      // tree: it would otherwise announce "nothing missing" about a collection that has not
      // loaded.
      footer={
        docked || single ? (
          <div inert aria-hidden="true">
            <BinderSpreadMap
              single={single}
              rows={loneFit.rows}
              pockets={single ? loadingPages(loneFit) : []}
              current={single ? 1 : 0}
              onGo={NOOP}
            />
          </div>
        ) : undefined
      }
      renderSlot={() => <BinderSlotSkeleton />}
      onPrev={NOOP}
      onNext={NOOP}
      canPrev={false}
      canNext={false}
    />
  );
}

/** The panel's numbers counted nowhere yet: docked, the page counts them, and a pool still loading has none. */
const NO_TALLIES = {stats: null, yours: null};

/**
 * The panel's numbers: the binder's collection toward its headlines, and in a friend's binder
 * the reader's own (`yours`), null without a collection of their own.
 */
function talliesOf(
  cards: LorcanaCard[],
  {entries, yourEntries}: {entries: CollectionEntries; yourEntries?: CollectionEntries},
  sets: readonly string[],
) {
  return {
    stats: tallyCollection(cards, entries, sets),
    yours: yourEntries ? tallyCollection(cards, yourEntries, sets) : null,
  };
}

function SectionContent({
  cards,
  waiting = [],
  matchedIds,
  counted,
  filtered,
  sortOrder,
  entries,
  yourEntries,
  friend = false,
  isLoading,
  error,
  onRetry,
  onCardSelect,
  onCountChange,
  ...controls
}: CollectionBinderSectionProps) {
  const {isMobile} = useResponsive();
  // Docked, the spread's arrows sit on its edges; the skeleton's too, so it has the binder's geometry.
  const docked = useSidePanelDocked();
  const windowOpen = useCardWindowOpen();
  // A phone's page has the rows its section fits, the loading binder's as the loaded one's.
  const [section, setSection] = useState<HTMLDivElement | null>(null);
  const loneFit = useLoneFit(section, isMobile);
  const {setCode} = controls;

  // Both states are rendered rather than falling through to an empty binder.
  // A binder of blank slots is indistinguishable from "you own none of this
  // set", so a failed fetch would read as a fact about the collection. The error
  // is an alert (#790): it replaces a binder the reader was waiting for.
  if (error !== null) {
    return (
      <div style={{...sectionStyle(isMobile, docked), display: 'flex', flexDirection: 'column', gap: SPACING.md}}>
        <p role="alert" style={{color: COLORS.textMuted, fontSize: `${FONT_SIZES.sm}px`, margin: 0}}>
          {error}
        </p>
        <div>
          <CtaButton variant="ghost" onClick={onRetry}>
            Try again
          </CtaButton>
        </div>
      </div>
    );
  }
  // The SAME chrome, with shimmer in the pockets and the panel's header already
  // in place, so the arrival is a change of contents and nothing else.
  if (isLoading) {
    return (
      <PanelLayout panel={{...controls, stats: null, filtered}} section={setSection}>
        <LoadingBinder single={isMobile} docked={docked} loneFit={loneFit} />
      </PanelLayout>
    );
  }

  // Docked, the page renders the panel itself (`DockedSetBody`): the tablet's rail counts here,
  // and a phone's cover.
  const {stats, yours} = docked ? NO_TALLIES : talliesOf(counted, {entries, yourEntries}, controls.sets);
  const shown = binderContents(cards, setCode, sortOrder, controls.sets).filter((card) => matchedIds.has(card.id));
  const slots = binderSlots(shown, {
    scope: setCode,
    sets: controls.sets,
    sortOrder,
    narrowed: filtered || controls.show !== 'all',
    waiting,
  });
  return (
    <PanelLayout panel={{...controls, stats, yours, filtered}} section={setSection}>
      {shown.length === 0 ? (
        <NoMatches show={controls.show} setCode={setCode} friend={friend} />
      ) : (
        <KeyedBinder
          axis={controls.axis}
          cover={isMobile ? <CoverNumbers {...controls} stats={stats} yours={yours} filtered={filtered} /> : undefined}
          slots={slots}
          bySet={namesStretches(setCode, sortOrder)}
          countsFor={(cardId) => entries[cardId] ?? ZERO}
          onSelect={onCardSelect}
          onCountChange={onCountChange}
          windowOpen={windowOpen}
          single={isMobile}
          loneFit={loneFit}
          pager={docked || isMobile ? 'map' : 'arrows'}
        />
      )}
    </PanelLayout>
  );
}

/** The cover's chosen headline: the cover's own, never a page turn's copy of it. */
function chosenHeadline(): HTMLElement | undefined {
  const chosen = document.querySelectorAll<HTMLElement>('[aria-label="Front cover"] [aria-pressed="true"]');
  return [...chosen].find((el) => !el.closest('[inert]'));
}

/**
 * Whether the binder that replaces the one on show opens on a phone's cover: only when the cover
 * was on show and the headline chosen there changed the cards the binder holds, as it does in the
 * Owned and Missing views (owner, 2026-10-27). A new set, sort or filter opens on page 1. The
 * focus, which left with the old cover's headline, goes to the new cover's chosen one.
 *
 * Noted while rendering (the "previous render" pattern), so the new binder mounts knowing.
 */
function useCoverKept(cards: string, axis: Axis) {
  const [shown, setShown] = useState(false);
  const [seen, setSeen] = useState({cards, axis, kept: false});
  if (seen.cards !== cards || seen.axis !== axis) {
    setSeen({cards, axis, kept: shown && seen.cards !== cards && seen.axis !== axis});
  }
  useLayoutEffect(() => {
    if (seen.kept && document.activeElement === document.body) chosenHeadline()?.focus({preventScroll: true});
  }, [seen]);
  return {opensOnCover: seen.kept, onCoverChange: setShown};
}

/**
 * The binder, keyed by what it holds, in order, so a new set, sort or filter opens it at its
 * start: the old page would land on unrelated cards. A count changed by hand leaves what it holds
 * alone (`useKeptCards`). A phone's cover outlives a change its own headlines make (`useCoverKept`).
 */
function KeyedBinder({axis, ...props}: ComponentProps<typeof CollectionBinder> & {axis: Axis}) {
  const cards = props.slots.map(slotKey).join();
  const kept = useCoverKept(cards, axis);
  return <CollectionBinder key={cards} {...props} {...kept} />;
}

/** Where the binder found nothing, for the scopes spanning sets; any set is "this set". */
const NO_MATCHES_WHERE: Record<string, string> = {
  [WHOLE_COLLECTION]: 'your collection',
  [ALL_PROMO_SETS]: 'your promo sets',
};
/** The same, in a friend's binder. */
const NO_MATCHES_THEIRS: Record<string, string> = {
  [WHOLE_COLLECTION]: 'their collection',
  [ALL_PROMO_SETS]: 'their promo sets',
};

/** The cards a view holds, as its empty line names them; All's are just "cards". */
const VIEW_CARDS: Record<BinderShow, string> = {
  all: 'cards',
  owned: 'owned cards',
  missing: 'missing cards',
  'you-need': 'cards you need',
  'they-need': 'cards they need',
};

/**
 * Nothing to show. Said in words, not as an empty binder: blank pockets would read as a
 * fact about the collection. With the binder showing only owned or only missing cards,
 * that view is as likely the reason as the filters.
 *
 * A status (#790), like Browse's empty grid: a search that empties the binder changes
 * nothing where the reader is typing, so it is announced.
 */
function NoMatches({show, setCode, friend}: {show: BinderShow; setCode: string; friend: boolean}) {
  const where = (friend ? NO_MATCHES_THEIRS : NO_MATCHES_WHERE)[setCode] ?? 'this set';
  return (
    <p
      role="status"
      aria-live="polite"
      style={{textAlign: 'center', padding: 64, margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
      {`No ${VIEW_CARDS[show]} in ${where} match your filters.`}
    </p>
  );
}

interface DockedSetBodyProps extends PanelControls {
  /** The cards to count: those the page's filters and search let through (see `BrowseListing.matched`). */
  cards: LorcanaCard[];
  /** Whether any filter or a search is on, so the numbers say they are filtered. */
  filtered: boolean;
  entries: CollectionEntries;
  /** In a friend's binder, the reader's own copies, for the "You" lines. */
  yourEntries?: CollectionEntries;
  /** True until the pool is complete: the header shows, the stats wait. */
  isLoading: boolean;
}

/**
 * What the docked panel and its picker in the toolbar show: the page's controls, and the
 * numbers both read, none until the pool is complete. Each still counts for itself: they
 * are two lazy components in two places on the page.
 */
function dockedPanel({cards, filtered, entries, yourEntries, isLoading, ...controls}: DockedSetBodyProps) {
  return {...controls, filtered, ...(isLoading ? NO_TALLIES : talliesOf(cards, {entries, yourEntries}, controls.sets))};
}

/**
 * The docked collection panel's body (desktop, right of the binder), with every set's
 * tally and the collection's, of the cards the page's filters let through. Its set
 * picker sits in the toolbar (`DockedSetPicker`). Lives in this module, so it rides the
 * binder's lazy chunk rather than Browse's.
 */
export function DockedSetBody(props: DockedSetBodyProps) {
  return <CollectionSetBody {...dockedPanel(props)} withPicker={false} />;
}

/**
 * The docked panel's set picker, in the toolbar beside Collection (desktop, owner
 * 2026-10-20), its list counting what the panel counts.
 */
export function DockedSetPicker(props: DockedSetBodyProps) {
  return <ToolbarSetPicker {...dockedPanel(props)} />;
}

/**
 * The set picker at the head of a phone's binder row (owner, 2026-10-25, #969), with the
 * headlines' percentages, which count what the docked panel counts.
 */
export function PhoneSetPicker(props: DockedSetBodyProps) {
  return <RowSetPicker {...dockedPanel(props)} />;
}
