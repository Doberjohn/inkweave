import {useId, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {QuantityStepper} from '../../shared/components';
import {CAP_LABEL, COLORS, FONT_SIZES, RADIUS, SPACING} from '../../shared/constants';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {useCardModal} from '../../shared/contexts/CardModalContext';
import {useCardWindowSlot} from '../../shared/contexts/cardWindowSlot';
import {useSession} from '../../shared/contexts/SessionContext';
import {isChaseRarity} from '../cards/loader';
import {useCollection} from './CollectionContext';
import type {CollectionEntry, Finish} from './collectionParser';

/**
 * "Your copies" (#826, option B of `public/mockups/collection-counts.html`): the card window's
 * own counter, a − count + per finish for the printing on show. It is how a phone changes a
 * count, and how a card reached from search is changed anywhere.
 *
 * `WindowCopies` portals it into the window's slot under the card, rendered by Browse with its
 * dialogs (`useBrowseCollection`), so it keeps the collection's context while the window, which
 * sits outside it, carries none of its code.
 *
 * ONE ROW PER FINISH, and the block keeps its height for a printing made only in foil: the
 * Normal row gives way to a line saying so rather than going. Desktop shrinks the art to make
 * room under it, so a block that lost a row when a pill switched printings would resize the
 * art under the reader's pointer.
 */

/** The steppers' size: the window's `md`, bigger than the binder's pills (owner, 2026-10-19). */
const STEPPER_HEIGHT = 32;

const BLOCK_STYLE: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  display: 'flex',
  flexDirection: 'column',
  gap: SPACING.sm,
  padding: `${SPACING.md}px ${SPACING.lg}px`,
  background: COLORS.surfaceRaised,
  border: `1px solid ${COLORS.surfaceBorder}`,
  borderRadius: RADIUS.lg,
};

/** A row as tall as its stepper, so the foil-only line holds the same place as a stepper row. */
const ROW_STYLE: CSSProperties = {
  minHeight: STEPPER_HEIGHT,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: SPACING.md,
};

const FINISH_LABEL: Record<Finish, string> = {normal: 'Normal', foil: 'Foil'};

interface CollectionCopiesProps {
  /** Copies held of the printing on show, per finish. */
  counts: CollectionEntry;
  /** The card's name, which the steppers' buttons say they add to or remove from. */
  cardName: string;
  /**
   * The printing's rarity where it is printed only in foil (Enchanted, Epic, Iconic: owner,
   * 2026-10-19), so only the Foil count is offered; absent for one printed in both.
   */
  foilOnly?: string;
  /** Set one finish's count. Never asked for less than 0: the − is disabled at 0. */
  onChange: (finish: Finish, count: number) => void;
}

export function CollectionCopies({counts, cardName, foilOnly, onChange}: CollectionCopiesProps) {
  const captionId = useId();
  return (
    <div role="group" aria-labelledby={captionId} data-testid="collection-copies" style={BLOCK_STYLE}>
      <span id={captionId} style={CAP_LABEL}>
        Your copies
      </span>
      {foilOnly ? (
        <p style={{...ROW_STYLE, margin: 0, fontSize: FONT_SIZES.base, color: COLORS.textMuted}}>
          {foilOnly} cards are only printed in foil.
        </p>
      ) : (
        <FinishRow finish="normal" count={counts.normal} cardName={cardName} onChange={onChange} />
      )}
      <FinishRow finish="foil" count={counts.foil} cardName={cardName} onChange={onChange} />
    </div>
  );
}

interface FinishRowProps {
  finish: Finish;
  count: number;
  cardName: string;
  onChange: (finish: Finish, count: number) => void;
}

/** One finish's count: its name, and its stepper in the binder's tone for it (foil is gold). */
function FinishRow({finish, count, cardName, onChange}: FinishRowProps) {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} style={ROW_STYLE}>
      <span id={labelId} style={{fontSize: FONT_SIZES.lg, color: COLORS.text}}>
        {FINISH_LABEL[finish]}
      </span>
      <QuantityStepper
        value={count}
        size="md"
        tone={finish === 'foil' ? 'foil' : 'default'}
        label={finish === 'foil' ? `foil ${cardName}` : cardName}
        decrementDisabled={count === 0}
        onIncrement={() => onChange(finish, count + 1)}
        onDecrement={() => onChange(finish, count - 1)}
      />
    </div>
  );
}

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};

/**
 * The rarity of the printing the card window shows: the variant's on show, else the card's own.
 * Enchanted, Epic and Iconic are printed only in foil (owner, 2026-10-19), which `isChaseRarity`
 * names; a promo is printed in both finishes, like any card (owner, 2026-10-18).
 */
function shownRarity(card: LorcanaCard, printingId: string | null): string | undefined {
  if (printingId === null) return card.rarity;
  return card.variants?.find((variant) => variant.id === printingId)?.rarity;
}

/**
 * "Your copies" in the open card window (#826), for the printing on show, on any window
 * opened on Browse while signed in with a collection: the binder's or the grid's (the
 * implementer's call, 2026-10-19, open for the owner to revisit).
 *
 * A PORTAL into the window's slot (`useCardWindowSlot`). The window sits outside the collection
 * providers, so the block renders from here, keeping their context, and none of the
 * collection's code enters the window's chunk. A component of its own, rendered with the page's
 * dialogs, so the slot arriving and the printing changing re-render it alone, not the page.
 *
 * Not until the account's copy has answered (`syncing`): an edit made before then would be
 * built on this browser's copy, and its upload would replace counts saved from another device
 * that the read was about to bring in. The binder waits the same way, behind its skeleton.
 */
export function WindowCopies() {
  const {slot, shownPrintingId} = useCardWindowSlot();
  const {selectedCardId, resolveCard} = useCardModal();
  const {getCardById} = useCardDataContext();
  const {user} = useSession();
  const {entries, hasCollection, syncing, setCount} = useCollection();
  const editable = user !== null && hasCollection && !syncing;
  if (!editable || slot === null) return null;
  if (selectedCardId === null) return null;
  // The window's own lookup: Core first, then the open's resolver (a card from sets 1-8).
  const card = getCardById(selectedCardId) ?? resolveCard?.(selectedCardId);
  if (card === undefined) return null;
  // A printing is a card of the collection's own: its counts are kept under its id.
  const printingId = shownPrintingId ?? selectedCardId;
  const rarity = shownRarity(card, shownPrintingId);
  return createPortal(
    <CollectionCopies
      counts={entries[printingId] ?? NO_COPIES}
      cardName={card.fullName}
      foilOnly={isChaseRarity(rarity) ? rarity : undefined}
      onChange={(finish, count) => setCount(printingId, finish, count)}
    />,
    slot,
  );
}
