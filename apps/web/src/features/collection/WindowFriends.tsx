import {useState} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {useCardModal} from '../../shared/contexts/CardModalContext';
import {useCardWindowSlot} from '../../shared/contexts/cardWindowSlot';
import {useSession} from '../../shared/contexts/SessionContext';
import {useResponsive} from '../../shared/hooks';
import {trackEvent} from '../../shared/lib/analytics';
import {printingCard} from '../cards/loader';
import {useCollection} from './CollectionContext';
import type {CollectionEntries, CollectionEntry} from './collectionParser';
import {finishesLacked, type Axis} from './collectionStats';
import {useFriendsCopies, type SharingFriend} from './friendsCopies';
import {FriendsHaveButton, FriendsHaveFailed} from './FriendsHaveButton';
import {foilOnly, friendsFor, friendsHaveLine} from './friendsHave';
import {FriendsWhoHaveIt} from './FriendsWhoHaveIt';
import {finishesOf} from './printingFinishes';
import {useWindowCard} from './windowCard';

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};

/** The printing the window shows, as a card of its own: the variant on show, else the card. */
function printingOf(card: LorcanaCard, printingId: string | null): {printing: LorcanaCard; printedName?: string} {
  const variant = printingId === null ? undefined : card.variants?.find((each) => each.id === printingId);
  return variant ? {printing: printingCard(card, variant), printedName: variant.printedName} : {printing: card};
}

/** The window's friends slot and the printing it shows, or null while no window holds the slot. */
interface Shown {
  slot: HTMLElement;
  printing: LorcanaCard;
  printedName?: string;
}

function useShown(): Shown | null {
  const {friendsSlot, shownPrintingId} = useCardWindowSlot();
  const card = useWindowCard();
  if (friendsSlot === null || card === undefined) return null;
  return {slot: friendsSlot, ...printingOf(card, shownPrintingId)};
}

type Place = (entries: CollectionEntries) => CollectionEntries;

/** The last friends placed: the count renders with each step through the window, and would place them all again. */
let placedFor: {sharing: readonly SharingFriend[]; place: Place; placed: SharingFriend[]} | null = null;

/** Friends' copies placed as the reader's are (`useCollection().place`), so both count the same way. */
function placedFriends(sharing: readonly SharingFriend[], place: Place): SharingFriend[] {
  if (placedFor?.sharing !== sharing || placedFor.place !== place) {
    placedFor = {sharing, place, placed: sharing.map((friend) => ({...friend, entries: place(friend.entries)}))};
  }
  return placedFor.placed;
}

/** Whether the reader's copies count yet: signed in with a collection, once the account's copy has answered. */
function useCounting(): boolean {
  const {user} = useSession();
  const {hasCollection, syncing} = useCollection();
  if (syncing) return false;
  return user !== null && hasCollection;
}

/**
 * The card window's count of the friends who have the card on show for the reader: a chip beside
 * the set's logo on a computer, a line under the copies on a phone, through a portal into the
 * window's friends slot (`useCardWindowSlot`), as `WindowCopies` fills its row. Pressing it opens
 * Friends who have it, over the window. Nothing on a card no sharing friend has for the reader
 * under `axis`, the headline the binder counts.
 *
 * Its own chunk, loaded only with both flags on: the friends' reads and the dialog stay out of
 * Browse's. The read starts when Browse shows, before any window opens (`useFriendsCopies`), so
 * a window opens with its count in place, rather than growing the header or the phone's column
 * a moment later.
 */
export function WindowFriends({axis}: {axis: Axis}) {
  const shown = useShown();
  const counting = useCounting();
  const copies = useFriendsCopies(counting, true);
  if (!counting || shown === null) return null;
  if (copies.status === 'failed') return <FailedCount shown={shown} axis={axis} onRetry={copies.retry} />;
  if (copies.status !== 'ready') return null;
  return <FriendsCount shown={shown} sharing={copies.sharing} notSharing={copies.notSharing.length} axis={axis} />;
}

interface FriendsCountProps {
  shown: Shown;
  sharing: readonly SharingFriend[];
  notSharing: number;
  axis: Axis;
}

/** The count, and Friends who have it behind it; nothing when no friend has the card for the reader. */
function FriendsCount({shown, sharing, notSharing, axis}: FriendsCountProps) {
  const {entries, place} = useCollection();
  const {isMobile} = useResponsive();
  const {closeCardModal} = useCardModal();
  const [open, setOpen] = useState(false);
  const {slot, printing, printedName} = shown;
  const have = friendsFor(printing, entries, placedFriends(sharing, place), axis);
  if (have.friends.length === 0) {
    // A re-read that leaves no friend with the card closes the dialog with its count, so it
    // can't pop open again on a later read that brings one back.
    if (open) setOpen(false);
    return null;
  }

  const finishes = finishesOf(printing);
  const show = () => {
    trackEvent('friends_who_have_it_opened', {from: 'window'});
    setOpen(true);
  };
  return (
    <>
      {createPortal(
        <FriendsHaveButton
          isMobile={isMobile}
          label={friendsHaveLine(have.friends.length, have.lacked, finishes)}
          gold={foilOnly(have)}
          onPress={show}
        />,
        slot,
      )}
      <FriendsWhoHaveIt
        isOpen={open}
        onClose={() => setOpen(false)}
        card={printing}
        printedName={printedName}
        finishes={finishes}
        held={entries[printing.id] ?? NO_COPIES}
        have={have}
        notSharing={notSharing}
        isMobile={isMobile}
        onFollow={() => {
          setOpen(false);
          closeCardModal();
        }}
      />
    </>
  );
}

/** A read that failed: said only on a card the reader lacks, where friends could have had it. */
function FailedCount({shown, axis, onRetry}: {shown: Shown; axis: Axis; onRetry: () => void}) {
  const {entries} = useCollection();
  const {isMobile} = useResponsive();
  if (finishesLacked(shown.printing, entries, axis).length === 0) return null;
  return createPortal(<FriendsHaveFailed isMobile={isMobile} onRetry={onRetry} />, shown.slot);
}
