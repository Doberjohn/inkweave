import {useState, type CSSProperties} from 'react';
import type {LorcanaCard} from '../deck/types';
import {CardTile} from '../cards/components/CardTile';
import {BinderSpread, PER_SPREAD} from '../cards/components/BinderSpread';
import {COLORS, DURATION, EASING, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';

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

export type Finish = 'normal' | 'foil';

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
  /** Copies held of this card in the finish on show. */
  ownedCount: (cardId: string) => number;
  finish: Finish;
  onSelect: (card: LorcanaCard) => void;
}

const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: SPACING.xxs,
  right: SPACING.xxs,
  zIndex: 2,
  minWidth: 18,
  height: 18,
  padding: `0 ${SPACING.xxs}px`,
  borderRadius: `${RADIUS.pill}px`,
  background: COLORS.primary,
  color: COLORS.background,
  fontSize: `${FONT_SIZES.xs}px`,
  fontWeight: 700,
  lineHeight: '18px',
  textAlign: 'center',
};

const numberStyle: CSSProperties = {
  position: 'absolute',
  left: SPACING.xxs,
  bottom: SPACING.xxs,
  zIndex: 2,
  fontSize: `${FONT_SIZES.xs}px`,
  fontWeight: 700,
  color: COLORS.text,
  background: COLORS.scrim,
  padding: `1px ${SPACING.xxs}px`,
  borderRadius: `${RADIUS.sm}px`,
};

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
  owned,
  dimmed,
  onSelect,
}: {
  card: LorcanaCard;
  owned: number;
  dimmed: boolean;
  onSelect: (card: LorcanaCard) => void;
}) {
  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        opacity: dimmed ? 0.16 : 1,
        filter: owned === 0 ? 'grayscale(1) brightness(0.45)' : undefined,
        transition: `opacity ${DURATION.base}ms ${EASING.smooth}`,
        pointerEvents: dimmed ? 'none' : undefined,
      }}>
      <CardTile
        card={card}
        onSelect={onSelect}
        isSelected={false}
        variant="minimal"
        borderRadius={0}
        useSmallImage
      />
      {owned > 1 && <span style={badgeStyle}>{owned}</span>}
      <span style={numberStyle}>{card.setNumber}</span>
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
  ownedCount,
  finish,
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
      label={
        `Spread ${current + 1} of ${total}` +
        (filtering
          ? ` · ${matchesHere} match${matchesHere === 1 ? '' : 'es'} in this set`
          : ` · cards ${start + 1}–${Math.min(start + PER_SPREAD, cards.length)}`)
      }
      onPrev={() => step(-1)}
      onNext={() => step(1)}
      canPrev={current > 0}
      canNext={current < total - 1}
      footnote={
        <>
          Showing <strong>{finish}</strong> copies. Greyed cards are ones you do not own; faded
          cards are filtered out but keep their place.
        </>
      }
      renderSlot={(index) => {
        const card = cards[index];
        if (!card) return null;
        return (
          <BinderSlot
            card={card}
            owned={ownedCount(card.id)}
            dimmed={!matchedIds.has(card.id)}
            onSelect={onSelect}
          />
        );
      }}
    />
  );
}
