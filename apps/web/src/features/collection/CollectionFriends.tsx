import {useEffect, useState, type CSSProperties} from 'react';
import {createPortal} from 'react-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {CtaButton} from '../../shared/components';
import {COLORS, FONT_SIZES, SPACING} from '../../shared/constants';
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
import {FriendsBadge} from './FriendsBadge';
import {FriendsHaveButton, FriendsHaveFailed} from './FriendsHaveButton';
import {foilOnly, foilsOnOffer, friendsFor, friendsHaveLine, type FriendsFor} from './friendsHave';
import {FriendsWhoHaveIt} from './FriendsWhoHaveIt';
import {finishesOf} from './printingFinishes';
import {useWindowCard} from './windowCard';

/**
 * Friends who have it: the card window's count, a pocket's badge, the empty Missing
 * view's pointer to the foils friends have, and the one dialog they open. Its own chunk, loaded
 * only with both flags on: the friends' reads and the dialog stay out of Browse's.
 */

const NO_COPIES: CollectionEntry = {normal: 0, foil: 0};

/** Where Friends who have it was opened from, for analytics: never an id, handle or name. */
type Source = 'badge' | 'window';

/** The card Friends who have it is for, kept once it closes so its exit still shows it. */
interface Asked {
  card: LorcanaCard;
  printedName?: string;
  from: Source;
  open: boolean;
}

/** Opens Friends who have it from a pocket's badge: the mounted `CollectionFriends`'s, else nothing. */
let askHost: ((asked: Asked) => void) | null = null;

function ask(card: LorcanaCard, from: Source, printedName?: string): Asked {
  trackEvent('friends_who_have_it_opened', {from});
  return {card, printedName, from, open: true};
}

/** A badge's press: asks the mounted host, and with none, opens and tracks nothing. */
function askFromBadge(card: LorcanaCard): void {
  if (askHost) askHost(ask(card, 'badge'));
}

/** Whether the read has friends who hold the card for the reader. */
const hasFriends = (have: FriendsFor | null | undefined): have is FriendsFor => (have?.friends.length ?? 0) > 0;

/** Whether the reader's copies count yet: signed in with a collection, once the account's copy has answered. */
function useCounting(): boolean {
  const {user} = useSession();
  const {hasCollection, syncing} = useCollection();
  if (syncing) return false;
  return user !== null && hasCollection;
}

type Place = (entries: CollectionEntries) => CollectionEntries;

/** The last friends placed, shared by every pocket and the window: each would place them all again, on every render. */
let placedFor: {sharing: readonly SharingFriend[]; place: Place; placed: SharingFriend[]} | null = null;

/** Friends' copies placed as the reader's are (`useCollection().place`), so both count the same way. */
function placedFriends(sharing: readonly SharingFriend[], place: Place): SharingFriend[] {
  if (placedFor?.sharing !== sharing || placedFor.place !== place) {
    placedFor = {sharing, place, placed: sharing.map((friend) => ({...friend, entries: place(friend.entries)}))};
  }
  return placedFor.placed;
}

/**
 * The friends' copies, read when `need`, the reader's own, and the sharing friends placed as the
 * reader's copies are once the read is in, else null; null while the reader's copies don't count.
 * Every count of what friends have for the reader starts here, so the badges, the window and the
 * foil pointer count alike.
 */
function useReadersFriends(need: boolean) {
  const counting = useCounting();
  const copies = useFriendsCopies(counting, need);
  const {entries, place} = useCollection();
  if (!counting) return null;
  return {copies, entries, placed: copies.status === 'ready' ? placedFriends(copies.sharing, place) : null};
}

/** The friends who hold `card` for the reader under `axis`, once their copies are in, else null. */
function useFriendsFor(card: LorcanaCard | null, axis: Axis, need: boolean) {
  const friends = useReadersFriends(need);
  if (friends === null) return null;
  const {copies, entries, placed} = friends;
  if (placed === null || card === null) return {copies, have: null};
  return {copies, have: friendsFor(card, entries, placed, axis)};
}

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

/**
 * The card window's count of the friends who have the card on show, and Friends who have it,
 * which the count and every pocket's badge open. The count is a chip beside the set's logo on a
 * computer, a line under the copies on a phone, through a portal into the window's friends slot
 * (`useCardWindowSlot`), as `WindowCopies` fills its row. Nothing on a card no sharing friend
 * has for the reader under `axis`, the headline the binder counts.
 *
 * The read starts when Browse shows, before any window opens or any badge asks
 * (`useFriendsCopies`), so a window opens with its count in place, rather than growing the
 * header or the phone's column a moment later.
 */
export function CollectionFriends({axis}: {axis: Axis}) {
  const shown = useShown();
  const {asked, setAsked, found} = useAsked(axis);
  return (
    <>
      {shown && <WindowCount shown={shown} axis={axis} onAsk={setAsked} />}
      {asked && (
        <FriendsDialog
          asked={asked}
          have={found?.have ?? NO_ONE}
          notSharing={notSharingOf(found)}
          onClose={() => setAsked({...asked, open: false})}
        />
      )}
    </>
  );
}

/**
 * The card Friends who have it was asked about, by the window's count or a pocket's badge
 * (`askHost`), and the friends who have it for the reader under `axis`.
 */
function useAsked(axis: Axis) {
  const [asked, setAsked] = useState<Asked | null>(null);
  useEffect(() => {
    askHost = setAsked;
    return () => {
      if (askHost === setAsked) askHost = null;
    };
  }, []);
  const found = useFriendsFor(asked?.card ?? null, axis, true);
  // Once the dialog can't show (a re-read leaves no friend with the card, or the copies stop
  // counting), it closes, so a later read that brings a friend back can't pop it open unasked.
  if (asked?.open && !hasFriends(found?.have)) setAsked({...asked, open: false});
  return {asked, setAsked, found};
}

/** How many friends don't share, once the read is in. */
function notSharingOf(found: ReturnType<typeof useFriendsFor>): number {
  return found?.copies.status === 'ready' ? found.copies.notSharing.length : 0;
}

/** The window's count, or its failed read on a card the reader lacks. */
function WindowCount({shown, axis, onAsk}: {shown: Shown; axis: Axis; onAsk: (asked: Asked) => void}) {
  const {isMobile} = useResponsive();
  const {entries} = useCollection();
  const {slot, printing, printedName} = shown;
  const found = useFriendsFor(printing, axis, true);
  if (found === null) return null;
  const {copies, have} = found;
  if (copies.status === 'failed') {
    if (finishesLacked(printing, entries, axis).length === 0) return null;
    return createPortal(<FriendsHaveFailed isMobile={isMobile} onRetry={copies.retry} />, slot);
  }
  if (!hasFriends(have)) return null;
  return createPortal(
    <FriendsHaveButton
      isMobile={isMobile}
      label={friendsHaveLine(have.friends.length, have.lacked, finishesOf(printing))}
      gold={foilOnly(have)}
      onPress={() => onAsk(ask(printing, 'window', printedName))}
    />,
    slot,
  );
}

const NO_ONE: FriendsFor = {lacked: [], friends: []};

interface FriendsDialogProps {
  asked: Asked;
  have: FriendsFor;
  notSharing: number;
  onClose: () => void;
}

/** Friends who have it for the card asked about, open while a friend still has it for the reader. */
function FriendsDialog({asked, have, notSharing, onClose}: FriendsDialogProps) {
  const {entries} = useCollection();
  const {isMobile} = useResponsive();
  const {closeCardModal} = useCardModal();
  const {card, printedName, from, open} = asked;
  return (
    <FriendsWhoHaveIt
      isOpen={open && hasFriends(have)}
      onClose={onClose}
      card={card}
      printedName={printedName}
      finishes={finishesOf(card)}
      held={entries[card.id] ?? NO_COPIES}
      have={have}
      notSharing={notSharing}
      isMobile={isMobile}
      onFollow={() => {
        onClose();
        // A row followed from the window leaves it too, for the friend's binder behind it.
        if (from === 'window') closeCardModal();
      }}
    />
  );
}

/**
 * A pocket's badge in the reader's own binder: the friends who hold its card in a finish the
 * reader lacks under `axis`, gold when every copy on offer is a foil. Nothing until their copies
 * are in, or when no friend has it for the reader.
 */
export function PocketFriends({card, axis}: {card: LorcanaCard; axis: Axis}) {
  const found = useFriendsFor(card, axis, true);
  const have = found?.have;
  if (!hasFriends(have)) return null;
  const count = have.friends.length;
  return (
    <FriendsBadge
      count={count}
      label={friendsHaveLine(count, have.lacked, finishesOf(card))}
      gold={foilOnly(have)}
      onPress={() => askFromBadge(card)}
    />
  );
}

/**
 * Under the empty Missing view under Complete set, where the reader holds every card: how many
 * of the foils they lack their friends have, and a way to see them, which picks Master set.
 * Nothing until friends' copies are in, or while no friend has one.
 */
export function FoilPointer({cards, onShow}: {cards: readonly LorcanaCard[]; onShow: () => void}) {
  const friends = useReadersFriends(true);
  if (!friends?.placed) return null;
  const {missing, onOffer} = foilsOnOffer(cards, friends.entries, friends.placed);
  if (onOffer === 0) return null;
  return (
    <div style={POINTER_STYLE}>
      <p style={{margin: 0}}>{`Your friends have ${onOffer} of the ${missing} ${missing === 1 ? 'foil' : 'foils'} you're missing.`}</p>
      <CtaButton variant="ghost" onClick={onShow}>
        Show them under Master set
      </CtaButton>
    </div>
  );
}

const POINTER_STYLE: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: SPACING.md,
  textAlign: 'center',
  color: COLORS.text,
  fontSize: `${FONT_SIZES.lg}px`,
};
