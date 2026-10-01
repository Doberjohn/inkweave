import {useState} from 'react';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CardTile} from '../cards/components/CardTile';
import {CollectionSlotSteppers, type StepperVariant} from './CollectionSlotSteppers';
import {useHover} from '../../shared/hooks/useHover';
import type {CollectionEntry, Finish} from './collectionParser';
import {BinderSpread, PER_SPREAD} from '../cards/components/BinderSpread';
import {DURATION, EASING} from '../../shared/constants';

/**
 * The collection binder (#553 Phase C): a set's cards in collector order.
 *
 * FIXED SLOTS, the opposite of `BrowseBinder`'s compacting fill. A grid answers
 * "which cards match?"; a binder answers "what am I missing?", and it can only do
 * that if a card's position never moves. So filtering DIMS in place rather than
 * reflowing, and an unowned card is shown greyed rather than as an empty slot —
 * you cannot tell which card is missing from a blank rectangle.
 *
 * The parchment, spine and pager come from `BinderSpread`, shared with Browse.
 *
 * Positions are only meaningful because Special-rarity promos are excluded: they
 * reuse base collector numbers, 160 contested slots across the pool, five cards
 * claiming Set 1's slot #1. See `binderCardsForSet`.
 */

/**
 * One set's cards as the binder needs them: Special promos dropped, collector
 * order imposed.
 *
 * BOTH STEPS ARE LOAD-BEARING and neither is free from the chunk. The chunks
 * carry Special rarity (28 of Set 1's 244) and arrive unsorted, so rendering one
 * straight would put cards in arbitrary positions and stack five of them on slot
 * #1. Dropping Special leaves Set 1 at 216 = exactly 9 spreads of 24.
 *
 * This lives here and not in the loader because the exclusion is the BINDER's
 * requirement — a Special card is genuinely ownable, and the Browse grid should
 * still show it. Only fixed positions need the promos gone.
 */
export function binderCardsForSet(cards: LorcanaCard[], setCode: string): LorcanaCard[] {
  return cards
    .filter((card) => card.setCode === setCode && card.rarity !== 'Special')
    .sort((a, b) => (a.setNumber ?? 0) - (b.setNumber ?? 0));
}

interface CollectionBinderProps {
  /** One set's cards, in collector-number order. */
  cards: LorcanaCard[];
  /**
   * Ids that pass the current filters, computed by the page with the SAME
   * `applyFiltersAndSort` Browse uses. Passing membership rather than the filter
   * options is what keeps the binder's dimming identical to Browse's filtering
   * by construction, instead of by two implementations agreeing.
   */
  matchedIds: Set<string>;
  /** Copies held of this card, per finish. */
  countsFor: (cardId: string) => CollectionEntry;
  /** Edit one finish's count. Spike-local until the write path is settled. */
  onChangeCount: (cardId: string, finish: Finish, next: number) => void;
  /** Which resting affordance an unowned slot shows. `?steppers=` picks it. */
  variant: StepperVariant;
  onSelect: (card: LorcanaCard) => void;
}

/**
 * One position in the binder.
 *
 * The two "absent" states are deliberately different: UNOWNED is desaturated
 * (the card exists, you don't have it) while FILTERED OUT is faded (the card is
 * there, it just isn't what you asked for). Collapsing them would make a filter
 * look like a gap in the collection.
 */
function BinderSlot({
  card,
  counts,
  dimmed,
  variant,
  onChangeCount,
  onSelect,
}: {
  card: LorcanaCard;
  counts: CollectionEntry;
  dimmed: boolean;
  variant: StepperVariant;
  onChangeCount: (cardId: string, finish: Finish, next: number) => void;
  onSelect: (card: LorcanaCard) => void;
}) {
  // Grey on the TOTAL, not on one finish. Grey now means "I do not have this
  // card" rather than "not in the finish you happen to be viewing" — the change
  // the toggle's removal makes possible. Measured on a real collection: zero
  // cards are foil-only, so nothing changes state today, but a first foil pull
  // would have read as unowned under the old rule.
  const owned = counts.normal + counts.foil;
  // The whole tile is the hover target, matching the deck pool. Scoped to the
  // steppers it was a ~20px strip at the bottom of the card, so moving the
  // pointer onto a card did nothing at all.
  const {hovered, hoverProps} = useHover();
  return (
    <div
      {...hoverProps}
      style={{
        position: 'relative',
        height: '100%',
        opacity: dimmed ? 0.16 : 1,
        transition: `opacity ${DURATION.base}ms ${EASING.smooth}`,
        pointerEvents: dimmed ? 'none' : undefined,
      }}>
      {/*
        The unowned treatment wraps ONLY the art. `filter` inherits down the
        whole subtree, so on the slot itself it greyed and dimmed the steppers
        too — leaving the `+` on an unowned card, the one control that card
        exists to offer, nearly invisible.
      */}
      <div
        style={{
          height: '100%',
          filter: owned === 0 ? 'grayscale(1) brightness(0.45)' : undefined,
        }}>
        <CardTile
          card={card}
          onSelect={onSelect}
          isSelected={false}
          variant="minimal"
          borderRadius={0}
          useSmallImage
        />
      </div>
      <CollectionSlotSteppers
        counts={counts}
        variant={variant}
        hovered={hovered}
        label={card.fullName || card.name}
        onChange={(finish, next) => onChangeCount(card.id, finish, next)}
      />
    </div>
  );
}

/** Spread indices holding at least one match, so paging can skip the empty ones. */
function spreadsWithMatches(cards: LorcanaCard[], matchedIds: Set<string>): number[] {
  const hits: number[] = [];
  for (let start = 0, s = 0; start < cards.length; start += PER_SPREAD, s++) {
    if (cards.slice(start, start + PER_SPREAD).some((c) => matchedIds.has(c.id))) hits.push(s);
  }
  return hits;
}

export function CollectionBinder({
  cards,
  matchedIds,
  countsFor,
  onChangeCount,
  variant,
  onSelect,
}: CollectionBinderProps) {
  const [spread, setSpread] = useState(0);
  const total = Math.max(1, Math.ceil(cards.length / PER_SPREAD));
  const current = Math.min(spread, total - 1);
  const start = current * PER_SPREAD;
  /**
   * Counted WITHIN this set, never as `matchedIds.size`. That set spans the whole
   * merged pool, so its size is the match count across all 3,242 cards — it read
   * "3176 match" on a 216-card binder, and comparing it to `cards.length` was
   * true even with no filters applied, permanently arming the skip-ahead pager.
   */
  const matchesHere = cards.filter((card) => matchedIds.has(card.id)).length;
  const filtering = matchesHere !== cards.length;

  /**
   * Sets are numbered BY INK, so an ink filter empties whole spreads rather than
   * scattering gaps within one — measured on Set 1, Amber's 36 cards land
   * `24 10 0 0 0 0 0 0 2`. Stepping one at a time would page through blanks.
   * Cost, keyword, text and inkwell filters interleave instead and hit every
   * spread, where this is a no-op. The label always reports the TRUE spread
   * number, so a jump from 2 to 9 stays visible.
   */
  function step(direction: 1 | -1) {
    if (!filtering) {
      setSpread(Math.max(0, Math.min(current + direction, total - 1)));
      return;
    }
    const hits = spreadsWithMatches(cards, matchedIds);
    const next =
      direction > 0 ? hits.find((s) => s > current) : [...hits].reverse().find((s) => s < current);
    if (next !== undefined) setSpread(next);
  }

  return (
    <BinderSpread
      start={start}
      onPrev={() => step(-1)}
      onNext={() => step(1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      renderSlot={(index) => {
        const card = cards[index];
        if (!card) return null;
        return (
          <BinderSlot
            card={card}
            counts={countsFor(card.id)}
            dimmed={!matchedIds.has(card.id)}
            variant={variant}
            onChangeCount={onChangeCount}
            onSelect={onSelect}
          />
        );
      }}
    />
  );
}
