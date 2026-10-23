import {useState, type CSSProperties, type PointerEvent} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../cards/components/CardTile';
import {PROMO_RARITY, smallImageUrl} from '../cards/loader';
import {CollectionSlotCounts, type SlotCountsEditor} from './CollectionSlotCounts';
import type {CollectionEntry, Finish} from './collectionParser';
import {finishesOf} from './printingFinishes';
import {BinderSpread, PER_PAGE, PER_SPREAD} from '../cards/components/BinderSpread';
import {BinderSpreadMap, type MapSet, type Pocket} from '../cards/components/BinderSpreadMap';
import {isOpenPocket, setLabel, type BinderSlot, type OpenPocket} from './binderCards';
import {printingName} from '../../shared/hooks/usePrintingSelection';
import {CardImageButton, CardLightbox} from '../../shared/components';
import {FONT_SIZES, RADIUS, SPACING, blackRgba} from '../../shared/constants';

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
 * The parchment, spine and arrows come from `BinderSpread`, the spread map from
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
   * What turns the pages: arrows beside the spread, or under a lone page (the
   * default); or, where Browse docks its panels, the spread map under the spread
   * (owner, 2026-10-12) and small discs on its outer edges (owner, 2026-10-22). The
   * map draws spreads, so a lone page keeps its arrows.
   */
  pager?: 'arrows' | 'map';
  /**
   * Change one finish's copies of a card (#826): a mouse pointing at a pocket opens its
   * copies stripe. Absent, the counts are read-only; a phone's lone page never takes it,
   * since nothing points there (its counts change in the card window).
   */
  onCountChange?: (cardId: string, finish: Finish, count: number) => void;
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

/** One position in the binder: the card, greyed while you hold none, and its counts. */
function CardPocket({
  card,
  counts,
  onSelect,
  tabIndex,
  onCountChange,
}: {
  card: LorcanaCard;
  counts: CollectionEntry;
  onSelect: (card: LorcanaCard) => void;
  /** The pocket's place in the Tab order, from `BinderSpread`: one pocket in view is a Tab stop. */
  tabIndex: number;
  onCountChange: CollectionBinderProps['onCountChange'];
}) {
  const {pointed, pointerProps} = usePointedByMouse();
  return (
    // `binder-pocket`: a pocket's tile glows stronger, to show on the parchment (index.css).
    <div className="binder-pocket" style={{position: 'relative', height: '100%'}} {...pointerProps}>
      {/*
        The unowned treatment greys ONLY the art: `.binder-unowned` (index.css)
        filters the tile's CHILDREN. On the slot it would grey the counts too, and
        on this wrapper it would also grey the tile's gold glow, which a filter on
        the children never reaches.
      */}
      <div className={isOwned(counts) ? undefined : 'binder-unowned'} style={{height: '100%'}}>
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
 * An open pocket on the parchment: dashed, in the parchment's own brown (black, thinned), with
 * its code over what it waits for.
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
  border: `2px dashed ${blackRgba(0.3)}`,
  borderRadius: `${RADIUS.sm}px`,
  color: blackRgba(0.65),
  textAlign: 'center',
};

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
 * A pocket with no card in it (#805): its code, the card a waiting promo is for, and why the
 * pocket is empty.
 */
function OpenPocketText({pocket}: {pocket: OpenPocket}) {
  return (
    <div style={OPEN_STYLE}>
      <span style={{fontSize: `${FONT_SIZES.xl}px`, fontWeight: 700}}>{promoLabel(pocket)}</span>
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
    // `binder-pocket`: its glow is a pocket's, stronger, to show on the parchment (index.css).
    <div className="binder-pocket" style={{height: '100%'}}>
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

/**
 * How the binder pages: a phone a lone page at a time, and a spread binder two pages at a
 * time, opening on the inside front cover (owner, 2026-10-18). The cover takes the first
 * spread's left page, so a spread's cards start a page in: the `lead`.
 */
const PAGES = {perView: PER_PAGE, lead: 0};
const SPREADS = {perView: PER_SPREAD, lead: PER_PAGE};

export function CollectionBinder({
  slots,
  bySet = false,
  countsFor,
  onSelect,
  single = false,
  pager = 'arrows',
  onCountChange,
}: CollectionBinderProps) {
  const {perView, lead} = single ? PAGES : SPREADS;
  // Held as the first SLOT in view, not a view number, so crossing the phone
  // breakpoint stays in the same part of the set: from spread 2 (slots 12-35) a
  // phone opens page 2 (slots 12-23), the first page of that spread's cards, and
  // back again. A stored view NUMBER would have jumped to other cards instead.
  const [firstSlot, setFirstSlot] = useState(0);
  const total = Math.max(1, Math.ceil((slots.length + lead) / perView));
  const current = Math.min(Math.floor((firstSlot + lead) / perView), total - 1);
  const goTo = (view: number) => {
    const to = Math.max(0, Math.min(view, total - 1));
    setFirstSlot(Math.max(0, to * perView - lead));
  };

  const map =
    pager === 'map' && !single ? (
      <BinderSpreadMap
        pockets={slots.map((slot) => pocketOf(slot, countsFor))}
        current={current}
        onGo={goTo}
        sets={bySet ? mapSets(slots) : undefined}
      />
    ) : undefined;

  return (
    <BinderSpread
      start={current * perView - lead}
      single={single}
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
        return (
          <CardPocket
            card={slot}
            counts={countsFor(slot.id)}
            onSelect={onSelect}
            tabIndex={tabIndex}
            onCountChange={single ? undefined : onCountChange}
          />
        );
      }}
    />
  );
}
