import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CopiesStripe} from '../../shared/components';
import type {StripePart} from '../../shared/components/CopiesStripe';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {useCardModal} from '../../shared/contexts/CardModalContext';
import {useCardWindowSlot, useHoldCopiesRow} from '../../shared/contexts/cardWindowSlot';
import {useSession} from '../../shared/contexts/SessionContext';
import {printedFullName} from '../../shared/hooks/usePrintingSelection';
import {useCollection} from './CollectionContext';
import type {CollectionEntry, Finish} from './collectionParser';
import {finishesOf, type FinishFacts} from './printingFinishes';

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};

/**
 * The printing the card window shows: the variant on show, else the card itself. Its finishes
 * (`finishesOf`) are its data's where the data names them, else its rarity's: Enchanted, Epic
 * and Iconic in foil alone (owner, 2026-10-19), and every other card in both. A promo defaults
 * to both (owner, 2026-10-18), and the data names the exceptions (#880). A promo printed under
 * another name carries it (`printedName`, #891).
 */
function shownPrinting(
  card: LorcanaCard,
  printingId: string | null,
): FinishFacts & {printedName?: string} {
  if (printingId === null) return card;
  return card.variants?.find((variant) => variant.id === printingId) ?? {};
}

/** The card the open window shows, by the window's own lookup: Core first, then the open's resolver (sets 1-8). */
function useWindowCard(): LorcanaCard | undefined {
  const {selectedCardId, resolveCard} = useCardModal();
  const {getCardById} = useCardDataContext();
  if (selectedCardId === null) return undefined;
  return getCardById(selectedCardId) ?? resolveCard?.(selectedCardId);
}

interface ShownCopies {
  counts: CollectionEntry;
  finishes: readonly Finish[];
  cardName: string;
  change: (finish: Finish, count: number) => void;
}

/** The stripe's parts: each finish's count, its buttons naming the card, foil ones as foil. */
function stripeParts({counts, finishes, cardName, change}: ShownCopies): StripePart[] {
  return finishes.map((finish) => ({
    label: finish === 'foil' ? `foil ${cardName}` : cardName,
    count: counts[finish],
    tone: finish === 'foil' ? 'foil' : 'default',
    onChange: (count) => change(finish, count),
  }));
}

/**
 * The card window's copies (#826): the copies stripe, as tall as the card's own black bar, for
 * the printing on show (owner, 2026-10-20, where the "Your copies" block under the card was), in
 * a row of its own under the card, so the full card shows (owner, 2026-10-22: it sat over the
 * card's foot). Always open: the window is where a phone or a keyboard changes a count, and
 * nothing points at it there. A part per finish the printing is made in (`finishesOf`), Foil
 * alone for Enchanted, Epic, Iconic and the alt foils, Normal alone for 1/C3.
 *
 * On any window opened on Browse while signed in with a collection, the grid's or the binder's
 * (owner, 2026-10-20). A PORTAL into the window's slot (`useCardWindowSlot`): the window sits
 * outside the collection providers, so the stripe renders from here, keeping their context, and
 * none of the collection's code enters the window's chunk. A component of its own, rendered with
 * the page's dialogs, so the slot arriving and the printing changing re-render it alone.
 *
 * Not until the account's copy has answered (`syncing`): an edit made before then would be built
 * on this browser's copy, and its upload would replace counts saved from another device that the
 * read was about to bring in. The binder waits the same way, behind its skeleton. The window's
 * row is held from sign-in on (`useHoldCopiesRow`), so the stripe arriving moves nothing.
 *
 * `onEdit` hears of each card whose count is set here: the binder behind the window keeps that
 * card in its Owned or Missing view (#826, owner 2026-10-20; `useKeptCards`).
 */
export function WindowCopies({onEdit}: {onEdit: (cardId: string) => void}) {
  const {slot, shownPrintingId} = useCardWindowSlot();
  const card = useWindowCard();
  const {user} = useSession();
  const {entries, hasCollection, syncing, setCount} = useCollection();
  const counting = user !== null && hasCollection;
  useHoldCopiesRow(counting);
  if (!counting || syncing) return null;
  if (slot === null || card === undefined) return null;
  // A printing is a card of the collection's own: its counts are kept under its id.
  const printingId = shownPrintingId ?? card.id;
  const counts = entries[printingId] ?? NO_COPIES;
  const shown = shownPrinting(card, shownPrintingId);
  const finishes = finishesOf(shown);
  const cardName = printedFullName(card, shown.printedName);
  const change = (finish: Finish, count: number) => {
    setCount(printingId, finish, count);
    onEdit(printingId);
  };
  return createPortal(
    <div role="group" aria-label={`Your copies: ${finishes.map((finish) => `${counts[finish]} ${finish}`).join(', ')}`}>
      <CopiesStripe open fit="bar" parts={stripeParts({counts, finishes, cardName, change})} />
    </div>,
    slot,
  );
}
