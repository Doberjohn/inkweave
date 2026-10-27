import {useEffect, useState, type AnimationEvent, type CSSProperties, type PointerEvent, type ReactNode} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../cards/components/CardTile';
import {PROMO_RARITY, smallImageUrl} from '../cards/loader';
import {CollectionSlotCounts, type SlotCountsEditor} from './CollectionSlotCounts';
import type {CollectionEntry, Finish} from './collectionParser';
import {finishesOf} from './printingFinishes';
import {BinderSpread} from '../cards/components/BinderSpread';
import {pagingOf, THREE_ROWS, type BinderPaging, type LoneFit} from '../cards/components/binderGeometry';
import {BinderSpreadMap, type MapSet, type Pocket} from '../cards/components/BinderSpreadMap';
import {isOpenPocket, setLabel, type BinderSlot, type OpenPocket} from './binderCards';
import {settleOf} from './binderPockets';
import {FINISH_WORD, printingName, promoCode} from 'inkweave-ui/lib/printings';
import {usePrefersReducedMotion} from 'inkweave-ui/utils/prefersReducedMotion';
import {preloadArt} from './preloadArt';
import {CardImageButton, CardLightbox} from '../../shared/components';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';

/**
 * The collection binder (#553 Phase C): the pockets it is given, in the order it is given them.
 *
 * IT HOLDS WHAT THE PAGE LISTS (owner, 2026-10-12): the cards that pass the page's
 * filters, in its sort, packed the way the grid packs them (see
 * `CollectionBinderSection`). With no filters and the default sort that is the whole
 * set in collector order, laid out like a real binder. Filters used to dim cards in
 * place so that none ever moved; the sort had already relaxed that, and filtering now
 * follows it. The whole collection goes set by set, each set continuing where the one
 * before ends.
 *
 * An unowned card is shown greyed rather than as an empty pocket: you cannot tell
 * which card is missing from a blank rectangle.
 *
 * A PROMO SET HOLDS A POCKET PER NUMBER (owner, 2026-10-17, #805): laid out in collector
 * order with nothing narrowing it, a number nobody has listed yet is an open pocket, and so
 * is a promo whose card is not out yet, named (`promoSetPockets`). An open pocket shows its
 * code; a promo's own pocket shows only its card, with no code over the art (owner, the same
 * day). Its tile's name still says the code ("25/P1 printing"), with a printing's finish
 * where it has one. A waiting promo with a scan shows the scan instead, greyed, and a click
 * opens it full size (`WaitingPromoPocket`).
 *
 * EACH POCKET HOLDS ITS CARD AS A REAL ONE WOULD (owner, 2026-10-24, #941): the card sits a
 * hair off straight at its pocket's foot (`settleOf`), a foil you hold wears a holo finish, and
 * a first copy slides in through the pocket's mouth as its colour comes in, a last one taken
 * out draining it to grey (`useShownCopies`).
 *
 * The pages, pockets, spine and arrows come from `BinderSpread`, the spread map from
 * `BinderSpreadMap`.
 */

interface CollectionBinderProps {
  /** The pockets to hold, in the order to hold them. */
  slots: readonly BinderSlot[];
  /**
   * The pockets go set by set (the whole collection in collector order) or edition by edition
   * (Curator's Collection): the map names each spread's sets or editions.
   */
  bySet?: boolean;
  /** Copies held of this card, per finish. */
  countsFor: (cardId: string) => CollectionEntry;
  onSelect: (card: LorcanaCard) => void;
  /**
   * One page per view instead of a spread (phone widths, owner 2026-10-07). It
   * changes the paging STEP, so it is this component's arithmetic as much as
   * `BinderSpread`'s layout, and both read it from this one prop.
   */
  single?: boolean;
  /**
   * How a phone's lone page fits the section: its rows, 3 or 4, change the paging step
   * as `single` does, so this component pages by them and hands them to `BinderSpread`.
   */
  loneFit?: LoneFit;
  /**
   * What turns the pages: arrows beside the spread, or under a lone page (the
   * default); or the map, under the spread where Browse docks its panels (owner,
   * 2026-10-12), with small discs on the spread's outer edges (owner, 2026-10-22),
   * and under a phone's lone page in its arrows' place, drawing pages (#969).
   */
  pager?: 'arrows' | 'map';
  /**
   * Change one finish's copies of a card (#826): a mouse pointing at a pocket opens its
   * copies stripe. Absent, the counts are read-only; a phone's lone page never takes it,
   * since nothing points there (its counts change in the card window).
   */
  onCountChange?: (cardId: string, finish: Finish, count: number) => void;
  /**
   * Whether the card window is open over the binder (#941). A pocket whose copies change while
   * it is plays its slide in or grey out once it closes, where the change can be seen.
   */
  windowOpen?: boolean;
  /**
   * What a phone's inside front cover holds, the page before page 1: the collection's numbers
   * (owner, 2026-10-27). The binder opens on page 1 all the same, so the cards come first.
   */
  cover?: ReactNode;
  /**
   * Opens on the cover instead: for the binder that replaces one showing it, when the headline
   * chosen there changed the cards it holds.
   */
  opensOnCover?: boolean;
  /** Told whether a phone's cover is the view on show, as it changes. */
  onCoverChange?: (shown: boolean) => void;
}

/**
 * Whether you hold the card at all. On the TOTAL, not on one finish: grey and the
 * map's ring both mean "I do not have this card", so a first foil pull must not
 * read as unowned.
 */
const isOwned = (counts: CollectionEntry) => counts.normal + counts.foil > 0;

/**
 * A waiting promo's scan, at the small size the pockets use, or none for an open pocket that has
 * no promo or no art. In dev every promo without official art has a scan's URL, so one whose
 * scan is missing shows its pocket's text on the spread (`WaitingPromoPocket`) but grey in the map.
 */
function waitingScan({id, imageUrl, imageHashSm}: OpenPocket): string | undefined {
  return id === undefined ? undefined : smallImageUrl({id, imageUrl, imageHashSm});
}

/**
 * Whether a pocket takes no focus, so the pockets' Tab stop and arrow keys pass over it: an
 * open one, unless it shows a waiting promo's scan, which a click or Enter opens full size.
 */
const takesNoFocus = (slot: BinderSlot) => isOpenPocket(slot) && waitingScan(slot) === undefined;

/**
 * A pocket as the map draws it: an open one, with a waiting promo's scan or without, or whether
 * you hold its card, in its ink or both of a dual-ink card's.
 */
function pocketOf(slot: BinderSlot, countsFor: (cardId: string) => CollectionEntry): Pocket {
  if (isOpenPocket(slot)) return {owned: false, inks: [], open: true, scan: waitingScan(slot) !== undefined};
  return {owned: isOwned(countsFor(slot.id)), inks: slot.ink2 ? [slot.ink, slot.ink2] : [slot.ink]};
}

/** Where each set starts among pockets that go set by set, named for the map's hover text. */
function mapSets(slots: readonly BinderSlot[]): MapSet[] {
  return slots.flatMap(({setCode = ''}, i) =>
    i > 0 && setCode === slots[i - 1].setCode ? [] : [{start: i, label: setLabel(setCode)}],
  );
}

/** An open pocket's code, as its promo's card would print it ("25/P1"), with its finish if it has one. */
const promoLabel = ({setNumber, setCode, finish, artVariant}: OpenPocket) =>
  printingName({rarity: PROMO_RARITY, number: setNumber, promoGrouping: setCode, finish, artVariant});

/** The code alone, without a twin's finish: the part of the label that never wraps (#973). */
const pocketCode = ({setNumber, setCode, artVariant}: OpenPocket) =>
  promoCode({number: setNumber, promoGrouping: setCode, artVariant});

/**
 * Whether a MOUSE rests on the element (#826). A touch or a pen never counts, so a tap on a
 * phone or a tablet opens the card as it always has and never leaves its stripe open; nor
 * do the mouse events iOS fires after a tap, which are no pointer events.
 *
 * The browser's own `pointerover`, not React's emulated `onPointerEnter`. When the card's
 * window closes over a resting mouse, the browser reports the pointer over the pocket again,
 * but the emulated entry never fires: the pointer came from the window's backdrop, which is
 * gone from the page. The pocket stayed shut until the mouse left it and came back.
 */
function usePointedByMouse() {
  const [pointed, setPointed] = useState(false);
  return {
    pointed,
    pointerProps: {
      onPointerOver: (e: PointerEvent) => {
        if (e.pointerType === 'mouse') setPointed(true);
      },
      onPointerLeave: () => setPointed(false),
    },
  };
}

/**
 * The pocket's counts editor while a mouse points at it and its counts can change, else
 * undefined: the pocket's copies stripe opens (`CollectionSlotCounts`).
 */
function pocketEditor(
  card: LorcanaCard,
  pointed: boolean,
  onCountChange: CollectionBinderProps['onCountChange'],
): SlotCountsEditor | undefined {
  if (!pointed || onCountChange === undefined) return undefined;
  return {
    finishes: finishesOf(card),
    onChange: (finish, count) => onCountChange(card.id, finish, count),
  };
}

/** The change a pocket plays as its card turns held or not (binder.css): sliding in, or greying out. */
type Play = 'slide-in' | 'grey-out';

/**
 * Whether the pocket shows its card as held, and the change it is playing (owner, 2026-10-24,
 * #941): a first copy slides in through the pocket's mouth as its colour comes in, and the last
 * one taken out drains it to grey, each once, cleared as its colour settles. Copies changed in
 * the card window play once it closes, where the pocket can be seen; under reduced motion the
 * pocket just changes. Set while rendering, as the React Compiler expects, from what the
 * pocket showed last: a pocket mounted with its counts already there plays nothing.
 */
function useShownCopies(owned: boolean, windowOpen: boolean) {
  const reducedMotion = usePrefersReducedMotion();
  const [shown, setShown] = useState(owned);
  const [play, setPlay] = useState<Play | null>(null);
  if (!windowOpen && owned !== shown) {
    const change: Play = owned ? 'slide-in' : 'grey-out';
    setShown(owned);
    setPlay(reducedMotion ? null : change);
  }
  return {
    shown,
    play,
    onAnimationEnd: (e: AnimationEvent) => {
      if (e.animationName.startsWith('binder-colour')) setPlay(null);
    },
  };
}

/** A pocket's classes for binder.css: the holo on a foil you hold, and the change it is playing. */
const pocketClass = (foil: boolean, play: Play | null) =>
  [foil ? 'binder-foil' : '', play ? `binder-${play}` : ''].filter(Boolean).join(' ') || undefined;

/** Where a card sits in its pocket (`settleOf`), as the custom properties binder.css reads. */
function settleStyle(cardId: string): CSSProperties {
  const {sx, sy, sr} = settleOf(cardId);
  return {'--sx': String(sx), '--sy': String(sy), '--sr': String(sr)} as CSSProperties;
}

/** One position in the binder: the card, greyed while you hold none, and its counts. */
function CardPocket({
  card,
  counts,
  onSelect,
  tabIndex,
  onCountChange,
  windowOpen,
}: {
  card: LorcanaCard;
  counts: CollectionEntry;
  onSelect: (card: LorcanaCard) => void;
  /** The pocket's place in the Tab order, from `BinderSpread`: one pocket in view is a Tab stop. */
  tabIndex: number;
  onCountChange: CollectionBinderProps['onCountChange'];
  windowOpen: boolean;
}) {
  const {pointed, pointerProps} = usePointedByMouse();
  const {shown, play, onAnimationEnd} = useShownCopies(isOwned(counts), windowOpen);
  return (
    <div
      className={pocketClass(shown && counts.foil > 0, play)}
      style={{position: 'relative', height: '100%', ...settleStyle(card.id)}}
      onAnimationEnd={onAnimationEnd}
      {...pointerProps}>
      {/*
        The unowned treatment greys ONLY the art: `.binder-unowned` (index.css)
        filters the tile's CHILDREN. On the slot it would grey the counts too, and
        on this wrapper it would also grey the tile's gold glow, which a filter on
        the children never reaches.
      */}
      <div className={shown ? undefined : 'binder-unowned'} style={{height: '100%'}}>
        <CardTile
          card={card}
          onSelect={onSelect}
          variant="minimal"
          borderRadius={0}
          useSmallImage
          tabIndex={tabIndex}
        />
      </div>
      <CollectionSlotCounts counts={counts} editor={pocketEditor(card, pointed, onCountChange)} />
    </div>
  );
}

/**
 * An open pocket: its code over what it waits for, in muted text on the black page. Its sleeve
 * shows the pocket empty (#941), where a dashed outline drew it on the parchment. A code wider
 * than the room inside the padding runs into the padding: the text never sizes its pocket
 * (`slotStyle` in BinderSpread.tsx, #973).
 */
const OPEN_STYLE: CSSProperties = {
  height: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: SPACING.xs,
  padding: SPACING.sm,
  color: COLORS.textMuted,
  textAlign: 'center',
};

/** An open pocket's code, and a twin's finish after it. */
const CODE_STYLE: CSSProperties = {fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700};

/**
 * Why an open pocket is empty: its promo's card is not out yet, its set never released it or
 * has yet to, or nobody has listed it.
 */
function openReason(pocket: OpenPocket) {
  if (pocket.fullName) return 'Not in our data yet';
  if (pocket.unreleased) return 'Not released';
  return pocket.upcoming ? 'Not released yet' : 'Not listed yet';
}

/**
 * A pocket with no card in it (#805): its code and a twin's finish, the card a waiting promo is
 * for, and why the pocket is empty.
 */
function OpenPocketText({pocket}: {pocket: OpenPocket}) {
  return (
    <div style={OPEN_STYLE}>
      {/* One line: Firefox breaks a code after its slash, "19/" over "C2" (#973). */}
      <span style={{...CODE_STYLE, whiteSpace: 'nowrap'}}>{pocketCode(pocket)}</span>
      {/* A twin's finish goes on lines of its own: on the code's, "28/C3 non-foil" ran past the pocket's
          sides. Its leading space renders nothing there and keeps the text "28/C3 non-foil". */}
      {pocket.finish && <span style={CODE_STYLE}>{` ${FINISH_WORD[pocket.finish]}`}</span>}
      {pocket.fullName && <span style={{fontSize: `${FONT_SIZES.xs}px`, fontWeight: 700}}>{pocket.fullName}</span>}
      <span style={{fontSize: `${FONT_SIZES.xs}px`, lineHeight: 1.3}}>{openReason(pocket)}</span>
    </div>
  );
}

/**
 * A waiting promo's pocket (owner, 2026-10-19: the three Hades of Set 15, whose card is not
 * out): its scan, greyed as an unowned card is, since no one can hold it yet, with no code over
 * the art and no copies. A click opens the scan full size, in colour (owner, 2026-10-23): the
 * card window would need the card, which stays out of the data until its set is. Its name says
 * what it is and why it waits. A scan that fails to load gives way to the pocket's text, which
 * still opens the full-size scan.
 */
function WaitingPromoPocket({
  pocket,
  src,
  tabIndex,
}: {
  pocket: OpenPocket;
  src: string;
  tabIndex: number;
}) {
  const [failed, setFailed] = useState(false);
  const [enlarged, setEnlarged] = useState(false);
  const printing = `${pocket.fullName}, ${promoLabel(pocket)} printing`;
  const name = `${printing}: ${openReason(pocket).toLowerCase()}`;
  return (
    <div style={{height: '100%'}}>
      <CardImageButton ariaLabel={name} onClick={() => setEnlarged(true)} tabIndex={tabIndex} tile>
        {failed ? (
          <OpenPocketText pocket={pocket} />
        ) : (
          <img
            className="binder-waiting-art"
            src={src}
            alt={name}
            title={name}
            loading="lazy"
            decoding="async"
            onError={() => setFailed(true)}
            style={{width: '100%', height: '100%', objectFit: 'cover', display: 'block'}}
          />
        )}
      </CardImageButton>
      {/* Beside the button, not in it: a backdrop click would reach the button and reopen it. */}
      {enlarged && (
        <CardLightbox
          src={pocket.imageUrl ?? src}
          alt={printing}
          onClose={() => setEnlarged(false)}
        />
      )}
    </div>
  );
}

/** An open pocket: a waiting promo's scan where it has one, else its code and why it is open. */
function OpenPocketView({pocket, tabIndex}: {pocket: OpenPocket; tabIndex: number}) {
  const src = waitingScan(pocket);
  if (src === undefined) return <OpenPocketText pocket={pocket} />;
  // Keyed by the scan, so a pocket reused for another promo never keeps one's failure or lightbox.
  return <WaitingPromoPocket key={src} pocket={pocket} src={src} tabIndex={tabIndex} />;
}

/** The art of the cards in view `view`: the pockets' small art, and the waiting promos' scans. */
function viewArt(slots: readonly BinderSlot[], view: number, {perView, lead}: BinderPaging): string[] {
  if (view < 0) return [];
  // A spread binder's first view starts a page before its first slot, at the front cover.
  const from = view * perView - lead;
  return slots
    .slice(Math.max(0, from), from + perView)
    .flatMap((slot) => (isOpenPocket(slot) ? waitingScan(slot) : smallImageUrl(slot)) ?? []);
}

/**
 * Loads the art of the views either side of the one in view (owner, 2026-10-26), so a page turned
 * either way lands with its cards drawn, where it showed their ink placeholders until they came.
 */
function usePreloadNeighbours(slots: readonly BinderSlot[], current: number, paging: BinderPaging) {
  useEffect(() => {
    preloadArt([...viewArt(slots, current + 1, paging), ...viewArt(slots, current - 1, paging)]);
  }, [slots, current, paging]);
}

/**
 * The first slot of view `view`. A phone's view 0 is its front cover, before slot 0, and keeps
 * its place there (`-lead`), so a change of rows on it stays on it; a spread's view 0 holds cards
 * from slot 0 on its right page.
 */
function firstSlotOf(view: number, {perView, lead}: BinderPaging, single: boolean): number {
  return single && view === 0 ? -lead : Math.max(0, view * perView - lead);
}

/** Where a binder opens, and what it holds. */
interface ViewOptions {
  slotCount: number;
  paging: BinderPaging;
  single: boolean;
  opensOnCover: boolean;
}

/**
 * The view on show, how many there are, and the way to another. Held as the first SLOT in view,
 * not a view number, so crossing the phone breakpoint stays in the same part of the set: from
 * spread 2 (slots 12-35) a phone opens page 2 (slots 9-17), the page that holds slot 12, and back
 * again. A stored view NUMBER would have jumped to other cards instead. A phone's page gaining a
 * row does the same: from page 4 of nine (slots 27-35), page 3 of twelve (slots 24-35), which
 * holds slot 27. Slot 0 opens a phone on page 1, past its cover, unless it opens on the cover.
 */
function useBinderView({slotCount, paging, single, opensOnCover}: ViewOptions) {
  const {perView, lead} = paging;
  const [firstSlot, setFirstSlot] = useState(() => (opensOnCover && single ? -lead : 0));
  const total = Math.max(1, Math.ceil((slotCount + lead) / perView));
  const current = Math.max(0, Math.min(Math.floor((firstSlot + lead) / perView), total - 1));
  const goTo = (view: number) => setFirstSlot(firstSlotOf(Math.max(0, Math.min(view, total - 1)), paging, single));
  return {current, total, goTo};
}

/** Tells `onCoverChange` whether a phone's cover is on show, each time that changes. */
function useCoverReport(onCover: boolean, onCoverChange: ((shown: boolean) => void) | undefined) {
  useEffect(() => {
    onCoverChange?.(onCover);
  }, [onCover, onCoverChange]);
}

export function CollectionBinder({
  slots,
  bySet = false,
  countsFor,
  onSelect,
  single = false,
  loneFit = THREE_ROWS,
  pager = 'arrows',
  onCountChange,
  windowOpen = false,
  cover,
  opensOnCover = false,
  onCoverChange,
}: CollectionBinderProps) {
  // A phone pages by nine, or twelve at 4 rows, a spread binder by 24, each a page in for its
  // front cover (`pagingOf`).
  const paging = pagingOf(single, loneFit.rows);
  const {current, total, goTo} = useBinderView({slotCount: slots.length, paging, single, opensOnCover});
  usePreloadNeighbours(slots, current, paging);
  // A spread's view 0 is its first, whose cover holds nothing.
  useCoverReport(single && current === 0, onCoverChange);

  const map =
    pager === 'map' ? (
      <BinderSpreadMap
        single={single}
        rows={loneFit.rows}
        pockets={slots.map((slot) => pocketOf(slot, countsFor))}
        current={current}
        onGo={goTo}
        sets={bySet ? mapSets(slots) : undefined}
      />
    ) : undefined;

  return (
    <BinderSpread
      start={current * paging.perView - paging.lead}
      single={single}
      loneFit={loneFit}
      cover={cover}
      arrows={map === undefined ? 'beside' : 'edges'}
      footer={map}
      cardCount={slots.length}
      isOpen={(index) => takesNoFocus(slots[index])}
      onPrev={() => goTo(current - 1)}
      onNext={() => goTo(current + 1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      renderSlot={(index, tabIndex) => {
        const slot = slots[index];
        if (!slot) return null;
        if (isOpenPocket(slot)) return <OpenPocketView pocket={slot} tabIndex={tabIndex} />;
        // Keyed by its card: a search or filter that moves another card into this pocket must
        // not hand it this card's last shown copies, or it would play a change it never had.
        return (
          <CardPocket
            key={slot.id}
            card={slot}
            counts={countsFor(slot.id)}
            onSelect={onSelect}
            tabIndex={tabIndex}
            onCountChange={single ? undefined : onCountChange}
            windowOpen={windowOpen}
          />
        );
      }}
    />
  );
}
