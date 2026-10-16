import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../cards/components/CardTile';
import {CollectionSlotCounts} from './CollectionSlotCounts';
import type {CollectionEntry} from './collectionParser';
import {BinderSpread, PER_PAGE, PER_SPREAD} from '../cards/components/BinderSpread';
import {BinderSpreadMap, type MapSet, type Pocket} from '../cards/components/BinderSpreadMap';
import {setName} from './binderCards';

/**
 * The collection binder (#553 Phase C): the cards it is given, pocket by pocket, in the
 * order it is given them.
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
 * The parchment, spine and arrows come from `BinderSpread`, the spread map from
 * `BinderSpreadMap`.
 *
 * Collector order means something only because Special-rarity promos are excluded:
 * they reuse base collector numbers, 160 contested slots across the pool, five cards
 * claiming Set 1's slot #1. See `binderCardsForSet` in `./binderCards`.
 */

interface CollectionBinderProps {
  /** The cards to hold, in the order to hold them. */
  cards: readonly LorcanaCard[];
  /** The cards go set by set (the whole collection in collector order): the map names each spread's sets. */
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

/** A card as the map draws it: whether you hold it, in its ink, or both inks for a dual-ink card. */
const pocketOf = (card: LorcanaCard, counts: CollectionEntry): Pocket => ({
  owned: isOwned(counts),
  inks: card.ink2 ? [card.ink, card.ink2] : [card.ink],
});

/** Where each set starts among cards that go set by set, named for the map's hover text. */
function mapSets(cards: readonly LorcanaCard[]): MapSet[] {
  return cards.flatMap(({setCode = ''}, i) =>
    i > 0 && setCode === cards[i - 1].setCode ? [] : [{start: i, label: `Set ${setCode}, ${setName(setCode)}`}],
  );
}

/** One position in the binder: the card, greyed while you hold none, and its counts. */
function BinderSlot({
  card,
  counts,
  onSelect,
}: {
  card: LorcanaCard;
  counts: CollectionEntry;
  onSelect: (card: LorcanaCard) => void;
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
        />
      </div>
      <CollectionSlotCounts counts={counts} />
    </div>
  );
}

export function CollectionBinder({
  cards,
  bySet = false,
  countsFor,
  onSelect,
  single = false,
  pager = 'arrows',
}: CollectionBinderProps) {
  const perView = single ? PER_PAGE : PER_SPREAD;
  // Held as the first SLOT in view, not a view number, so crossing the phone
  // breakpoint stays in the same part of the set: from spread 1 (slots 24-47) a
  // phone opens page 2 (slots 24-35), the first page of that spread, and back
  // again. A stored view NUMBER would have jumped to spread 2's cards instead.
  const [firstSlot, setFirstSlot] = useState(0);
  const total = Math.max(1, Math.ceil(cards.length / perView));
  const current = Math.min(Math.floor(firstSlot / perView), total - 1);
  const goTo = (view: number) => setFirstSlot(Math.max(0, Math.min(view, total - 1)) * perView);

  const map =
    pager === 'map' && !single ? (
      <BinderSpreadMap
        pockets={cards.map((card) => pocketOf(card, countsFor(card.id)))}
        current={current}
        onGo={goTo}
        sets={bySet ? mapSets(cards) : undefined}
      />
    ) : undefined;

  return (
    <BinderSpread
      start={current * perView}
      single={single}
      arrows={map === undefined}
      footer={map}
      cardCount={cards.length}
      onPrev={() => goTo(current - 1)}
      onNext={() => goTo(current + 1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      renderSlot={(index) => {
        const card = cards[index];
        if (!card) return null;
        return <BinderSlot card={card} counts={countsFor(card.id)} onSelect={onSelect} />;
      }}
    />
  );
}
