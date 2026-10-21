import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CopiesStripe} from '../../shared/components';
import type {StripePart} from '../../shared/components/CopiesStripe';
import {useCardDataContext} from '../../shared/contexts/CardDataContext';
import {useCardModal} from '../../shared/contexts/CardModalContext';
import {useCardWindowSlot} from '../../shared/contexts/cardWindowSlot';
import {useSession} from '../../shared/contexts/SessionContext';
import {isChaseRarity} from '../cards/loader';
import {useCollection} from './CollectionContext';
import type {CollectionEntry, Finish} from './collectionParser';

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};
const FINISHES: Finish[] = ['normal', 'foil'];
const FOIL_ONLY: Finish[] = ['foil'];

/**
 * The rarity of the printing the card window shows: the variant's on show, else the card's own.
 * Enchanted, Epic and Iconic are printed only in foil (owner, 2026-10-19), which `isChaseRarity`
 * names; a promo is printed in both finishes, like any card (owner, 2026-10-18).
 */
function shownRarity(card: LorcanaCard, printingId: string | null): string | undefined {
  if (printingId === null) return card.rarity;
  return card.variants?.find((variant) => variant.id === printingId)?.rarity;
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
  finishes: Finish[];
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
 * The card window's copies (#826): the copies stripe over the card's foot, as tall as the card's
 * own black bar, for the printing on show (owner, 2026-10-20, where the "Your copies" block under
 * the card was). Always open: the window is where a phone or a keyboard changes a count, and
 * nothing points at it there. A part per finish the printing is made in, Foil alone for
 * Enchanted, Epic and Iconic.
 *
 * On any window opened on Browse while signed in with a collection, the grid's or the binder's
 * (owner, 2026-10-20). A PORTAL into the window's slot (`useCardWindowSlot`): the window sits
 * outside the collection providers, so the stripe renders from here, keeping their context, and
 * none of the collection's code enters the window's chunk. A component of its own, rendered with
 * the page's dialogs, so the slot arriving and the printing changing re-render it alone.
 *
 * Not until the account's copy has answered (`syncing`): an edit made before then would be built
 * on this browser's copy, and its upload would replace counts saved from another device that the
 * read was about to bring in. The binder waits the same way, behind its skeleton.
 *
 * `onEdit` hears of each card whose count is set here: the binder behind the window keeps that
 * card in its Owned or Missing view (#826, owner 2026-10-20; `useKeptCards`).
 */
export function WindowCopies({onEdit}: {onEdit: (cardId: string) => void}) {
  const {slot, shownPrintingId} = useCardWindowSlot();
  const card = useWindowCard();
  const {user} = useSession();
  const {entries, hasCollection, syncing, setCount} = useCollection();
  const editable = user !== null && hasCollection && !syncing;
  if (!editable || slot === null) return null;
  if (card === undefined) return null;
  // A printing is a card of the collection's own: its counts are kept under its id.
  const printingId = shownPrintingId ?? card.id;
  const counts = entries[printingId] ?? NO_COPIES;
  const finishes = isChaseRarity(shownRarity(card, shownPrintingId)) ? FOIL_ONLY : FINISHES;
  const change = (finish: Finish, count: number) => {
    setCount(printingId, finish, count);
    onEdit(printingId);
  };
  return createPortal(
    <div role="group" aria-label={`Your copies: ${finishes.map((finish) => `${counts[finish]} ${finish}`).join(', ')}`}>
      <CopiesStripe open fit="bar" parts={stripeParts({counts, finishes, cardName: card.fullName, change})} />
    </div>,
    slot,
  );
}
