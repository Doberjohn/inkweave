import {useRef, type ReactNode} from 'react';
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
import {tallyCollection} from './collectionStats';
import {
  CollectionSetBody,
  CollectionSetRail,
  CollectionSetStrip,
  ToolbarSetPicker,
  type AxisChoice,
  type BinderView,
  type CollectionSetPanelProps,
  type SetSwitching,
} from './CollectionSetPanel';
import {BROWSE_GUTTER, useSidePanelDocked} from '../cards/components/BrowseSidePanel';
import {BinderSpread, BinderSlotSkeleton, PER_PAGE} from '../cards/components/BinderSpread';
import {BinderSpreadMap} from '../cards/components/BinderSpreadMap';
import {CtaButton} from '../../shared/components';
import {useResponsive} from '../../shared/hooks/useResponsive';
import {COLORS, FONT_SIZES, SPACING, type BrowseSortOrder} from '../../shared/constants';

/**
 * Collection mode's content: the set panel, and that set's binder.
 *
 * THE SET IS CHOSEN IN THE COLLECTION PANEL'S SET LIST (owner, 2026-10-12; a picker
 * under the set's logo before), through the `?binder=` param, and only there: the
 * filters panel drops its Set section in collection mode. See `CollectionSetPanel`.
 *
 * THE PANEL ADAPTS (owner, 2026-10-07): on desktop it is docked on the binder's
 * right, under the Collection button (owner, 2026-10-08; it was a tab beside the
 * filters before), and the PAGE renders it (see `DockedSetBody`), so this section
 * draws only the binder; on tablets, where nothing docks, a collapsible rail; on
 * phones, a strip above the page.
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
 * in the band under the spread; see `BinderSpreadMap`.
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

/**
 * Shared by every branch, so the box around them matches.
 *
 * A phone's single page is WIDTH-driven, so its height is not bounded by the
 * space left under the toolbar, and Browse's `<main>` clips overflow. Measured:
 * at 375x667 the arrows clear the bottom by 2px; a shorter phone would hide them.
 * Scrolling the section keeps them reachable at any height. A desktop spread is
 * height-capped and never needs it.
 *
 * DOCKED, THE SIDES ARE BROWSE'S GUTTER (owner, 2026-10-08): the binder, drawn
 * there without arrows or padding of its own, starts where the search bar does,
 * one gutter past the filters panel, and stops one gutter short of the set panel.
 * The bottom matches the panels' own, so a full-height binder ends level with them.
 */
function sectionStyle(isMobile: boolean, docked = false): React.CSSProperties {
  const gutter = isMobile ? SPACING.sm : SPACING.xxl;
  const sides = docked ? BROWSE_GUTTER : gutter;
  return {padding: `0 ${sides}px ${gutter}px`, height: '100%', ...(isMobile && {overflowY: 'auto'})};
}

/** What the page passes through to the collection panel: set switching, the binder view and the chosen headline. */
type PanelControls = SetSwitching & BinderView & AxisChoice;

/**
 * The set panel around the binder, where the page does not dock it: a strip
 * above the page on a phone, so the page keeps the full width, and a rail beside
 * the binder on a tablet.
 */
function PanelLayout({panel, children}: {panel: CollectionSetPanelProps; children: ReactNode}) {
  const {isMobile} = useResponsive();
  const docked = useSidePanelDocked();
  if (docked) return <div style={sectionStyle(false, true)}>{children}</div>;
  if (isMobile) {
    return (
      <div style={sectionStyle(true)}>
        <CollectionSetStrip {...panel} />
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
  /** Owned copies per card id, split by finish. */
  entries: CollectionEntries;
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

function SectionContent({
  cards,
  waiting = [],
  matchedIds,
  counted,
  filtered,
  sortOrder,
  entries,
  isLoading,
  error,
  onRetry,
  onCardSelect,
  onCountChange,
  ...controls
}: CollectionBinderSectionProps) {
  const {isMobile} = useResponsive();
  // Docked, the spread goes without arrows; the skeleton too, so it has the binder's geometry.
  const docked = useSidePanelDocked();
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
      <PanelLayout panel={{...controls, stats: null, filtered}}>
        <BinderSpread
          // Spreads open on the front cover, as the binder does (owner, 2026-10-18); a phone's page has none.
          start={isMobile ? 0 : -PER_PAGE}
          single={isMobile}
          arrows={!docked}
          // Docked, a map of one empty spread holds the band the real map will fill. It holds
          // no cards yet, so it is out of the Tab order and the accessibility tree: it would
          // otherwise announce "nothing missing" about a collection that has not loaded.
          footer={
            docked ? (
              <div inert aria-hidden="true">
                <BinderSpreadMap pockets={[]} current={0} onGo={NOOP} />
              </div>
            ) : undefined
          }
          renderSlot={() => <BinderSlotSkeleton />}
          onPrev={NOOP}
          onNext={NOOP}
          canPrev={false}
          canNext={false}
        />
      </PanelLayout>
    );
  }

  // Docked, the page renders the panel itself (`DockedSetBody`); no need to count here.
  const stats = docked ? null : tallyCollection(counted, entries, controls.sets);
  const shown = binderContents(cards, setCode, sortOrder, controls.sets).filter((card) => matchedIds.has(card.id));
  const slots = binderSlots(shown, {
    scope: setCode,
    sets: controls.sets,
    sortOrder,
    narrowed: filtered || controls.show !== 'all',
    waiting,
  });
  return (
    <PanelLayout panel={{...controls, stats, filtered}}>
      {shown.length === 0 ? (
        <NoMatches show={controls.show} setCode={setCode} />
      ) : (
        <CollectionBinder
          // Keyed by what it holds, in order, so a new set, sort or filter opens the
          // binder at its first spread: the old page would land on unrelated cards. A
          // count changed by hand leaves what it holds alone (`useKeptCards`).
          key={slots.map(slotKey).join()}
          slots={slots}
          bySet={namesStretches(setCode, sortOrder)}
          countsFor={(cardId) => entries[cardId] ?? ZERO}
          onSelect={onCardSelect}
          onCountChange={onCountChange}
          single={isMobile}
          pager={docked ? 'map' : 'arrows'}
        />
      )}
    </PanelLayout>
  );
}

/** Where the binder found nothing, for the scopes spanning sets; any set is "this set". */
const NO_MATCHES_WHERE: Record<string, string> = {
  [WHOLE_COLLECTION]: 'your collection',
  [ALL_PROMO_SETS]: 'your promo sets',
};

/**
 * Nothing to show. Said in words, not as an empty binder: blank pockets would read as a
 * fact about the collection. With the binder showing only owned or only missing cards,
 * that view is as likely the reason as the filters.
 *
 * A status (#790), like Browse's empty grid: a search that empties the binder changes
 * nothing where the reader is typing, so it is announced.
 */
function NoMatches({show, setCode}: {show: BinderShow; setCode: string}) {
  const where = NO_MATCHES_WHERE[setCode] ?? 'this set';
  return (
    <p
      role="status"
      aria-live="polite"
      style={{textAlign: 'center', padding: 64, margin: 0, color: COLORS.textMuted, fontSize: `${FONT_SIZES.xl}px`}}>
      {show === 'all' ? `No cards in ${where} match your filters.` : `No ${show} cards in ${where} match your filters.`}
    </p>
  );
}

interface DockedSetBodyProps extends PanelControls {
  /** The cards to count: those the page's filters and search let through (see `BrowseListing.matched`). */
  cards: LorcanaCard[];
  /** Whether any filter or a search is on, so the numbers say they are filtered. */
  filtered: boolean;
  entries: CollectionEntries;
  /** True until the pool is complete: the header shows, the stats wait. */
  isLoading: boolean;
}

/**
 * The docked collection panel's body (desktop, right of the binder), with every set's
 * tally and the collection's, of the cards the page's filters let through. Its set
 * picker sits in the toolbar (`DockedSetPicker`). Lives in this module, so it rides the
 * binder's lazy chunk rather than Browse's.
 */
export function DockedSetBody({cards, filtered, entries, isLoading, ...controls}: DockedSetBodyProps) {
  const stats = isLoading ? null : tallyCollection(cards, entries, controls.sets);
  return <CollectionSetBody {...controls} stats={stats} filtered={filtered} withPicker={false} />;
}

/**
 * The docked panel's set picker, in the toolbar beside Collection (desktop, owner
 * 2026-10-20), its list counting what the panel counts.
 */
export function DockedSetPicker({cards, filtered, entries, isLoading, ...controls}: DockedSetBodyProps) {
  const stats = isLoading ? null : tallyCollection(cards, entries, controls.sets);
  return <ToolbarSetPicker {...controls} stats={stats} filtered={filtered} />;
}
