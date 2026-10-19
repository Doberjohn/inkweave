import {useState, type CSSProperties} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../cards/components/CardTile';
import {PROMO_RARITY, smallImageUrl} from '../cards/loader';
import {CollectionSlotCounts} from './CollectionSlotCounts';
import type {CollectionEntry} from './collectionParser';
import {BinderSpread, PER_PAGE, PER_SPREAD} from '../cards/components/BinderSpread';
import {BinderSpreadMap, type MapSet, type Pocket} from '../cards/components/BinderSpreadMap';
import {isOpenPocket, setLabel, type BinderSlot, type OpenPocket} from './binderCards';
import {printingName} from '../../shared/hooks/usePrintingSelection';
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
 * where it has one.
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
   * (owner, 2026-10-12). The map draws spreads, so a lone page keeps its arrows.
   */
  pager?: 'arrows' | 'map';
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
 * scan is missing shows its pocket's text on the spread (`OpenPocketArt`) but grey in the map.
 */
function waitingScan({id, imageUrl, imageHashSm}: OpenPocket): string | undefined {
  return id === undefined ? undefined : smallImageUrl({id, imageUrl, imageHashSm});
}

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

/** One position in the binder: the card, greyed while you hold none, and its counts. */
function CardPocket({
  card,
  counts,
  onSelect,
  tabIndex,
}: {
  card: LorcanaCard;
  counts: CollectionEntry;
  onSelect: (card: LorcanaCard) => void;
  /** The pocket's place in the Tab order, from `BinderSpread`: one pocket in view is a Tab stop. */
  tabIndex: number;
}) {
  return (
    <div style={{position: 'relative', height: '100%'}}>
      {/*
        The unowned treatment greys ONLY the art: `.binder-unowned` (index.css)
        filters the tile's CHILDREN. On the slot it would grey the counts too, and
        on this wrapper it would also grey the tile's gold hover ring
        (`.card-tile::after`), which a filter on the children never reaches.
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
      <CollectionSlotCounts counts={counts} />
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
 * A waiting promo's scan (owner, 2026-10-19: the three Hades of Set 15, whose card is not out):
 * greyed as an unowned card is, since no one can hold it yet, with no code over the art, and
 * nothing to open. Its name says what it is and why it waits. A scan that fails to load gives
 * way to the pocket's text.
 */
function OpenPocketArt({pocket, src}: {pocket: OpenPocket; src: string}) {
  const [failed, setFailed] = useState(false);
  if (failed) return <OpenPocketText pocket={pocket} />;
  const name = `${pocket.fullName}, ${promoLabel(pocket)} printing: ${openReason(pocket).toLowerCase()}`;
  return (
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
  );
}

/** An open pocket: a waiting promo's scan where it has one, else its code and why it is open. */
function OpenPocketView({pocket}: {pocket: OpenPocket}) {
  const src = waitingScan(pocket);
  if (src === undefined) return <OpenPocketText pocket={pocket} />;
  // Keyed by the scan, so a pocket reused for another promo never keeps one's failure.
  return <OpenPocketArt key={src} pocket={pocket} src={src} />;
}

export function CollectionBinder({
  slots,
  bySet = false,
  countsFor,
  onSelect,
  single = false,
  pager = 'arrows',
}: CollectionBinderProps) {
  const perView = single ? PER_PAGE : PER_SPREAD;
  // A spread opens on the inside front cover (owner, 2026-10-18, #806), which takes the
  // first spread's left page, so the slots start a page in. A phone shows a page at a time,
  // and no cover.
  const lead = single ? 0 : PER_PAGE;
  // Held as the first SLOT in view, not a view number, so crossing the phone
  // breakpoint stays in the same part of the set: from the third spread (slots 36-59)
  // a phone opens page 4 (slots 36-47), the first page of that spread, and back
  // again. A stored view NUMBER would have opened page 3 (slots 24-35) instead.
  const [firstSlot, setFirstSlot] = useState(0);
  const total = Math.max(1, Math.ceil((slots.length + lead) / perView));
  const current = Math.min(Math.floor((firstSlot + lead) / perView), total - 1);
  const goTo = (view: number) => setFirstSlot(Math.max(0, Math.min(view, total - 1) * perView - lead));

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
      arrows={map === undefined}
      footer={map}
      cardCount={slots.length}
      isOpen={(index) => isOpenPocket(slots[index])}
      onPrev={() => goTo(current - 1)}
      onNext={() => goTo(current + 1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      renderSlot={(index, tabIndex) => {
        const slot = slots[index];
        if (!slot) return null;
        if (isOpenPocket(slot)) return <OpenPocketView pocket={slot} />;
        return <CardPocket card={slot} counts={countsFor(slot.id)} onSelect={onSelect} tabIndex={tabIndex} />;
      }}
    />
  );
}
