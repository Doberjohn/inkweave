import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {CollectionEntries, Finish} from './collectionParser';
import {finishesLacked, type Axis} from './collectionStats';
import type {SharingFriend} from './friendsCopies';

/** A sharing friend's copies of a card in the finishes the reader lacks. */
export interface FriendHas {
  friend: SharingFriend;
  normal: number;
  foil: number;
}

/** What friends have of a card for the reader: the finishes they lack, and who holds one. */
export interface FriendsFor {
  lacked: readonly Finish[];
  friends: FriendHas[];
}

/**
 * A friend's copies in the finishes the reader lacks, or none: under Master set their normal
 * of a card the reader holds in normal is no copy for them, and isn't counted.
 */
function hasOf(friend: SharingFriend, cardId: string, lacked: readonly Finish[]): FriendHas[] {
  const held = friend.entries[cardId];
  if (held === undefined) return [];
  const normal = lacked.includes('normal') ? held.normal : 0;
  const foil = lacked.includes('foil') ? held.foil : 0;
  return normal + foil > 0 ? [{friend, normal, foil}] : [];
}

const copiesOf = ({normal, foil}: FriendHas) => normal + foil;

const mostCopiesFirst = (a: FriendHas, b: FriendHas) =>
  copiesOf(b) - copiesOf(a) || a.friend.name.localeCompare(b.friend.name);

/**
 * The finishes of `card` the reader lacks toward `axis` (`finishesLacked`, as a friend's You
 * need counts them), and the sharing friends holding a copy in one: most copies first, then by
 * name. `friends` hold their copies placed as the reader's are (`useCollection().place`).
 */
export function friendsFor(
  card: LorcanaCard,
  you: CollectionEntries,
  friends: readonly SharingFriend[],
  axis: Axis,
): FriendsFor {
  const lacked = finishesLacked(card, you, axis);
  if (lacked.length === 0) return {lacked, friends: []};
  return {lacked, friends: friends.flatMap((friend) => hasOf(friend, card.id, lacked)).sort(mostCopiesFirst)};
}

/** Every copy on offer is a foil: the count in brushed gold, as the copies stripe marks a foil. */
export const foilOnly = ({friends}: FriendsFor) => friends.every((row) => row.normal === 0);

/** "11 friends", "1 friend". */
export const friendsWord = (count: number) => (count === 1 ? '1 friend' : `${count} friends`);

/** "11 friends have it", or "6 friends have the foil" when the reader lacks only one of the card's finishes. */
export function friendsHaveLine(count: number, lacked: readonly Finish[], finishes: readonly Finish[]): string {
  const what = lacked.length === 1 && finishes.length > 1 ? `the ${lacked[0]}` : 'it';
  return `${friendsWord(count)} ${count === 1 ? 'has' : 'have'} ${what}`;
}

/** The foils the reader lacks among `cards`, and how many of them a sharing friend holds. */
export interface FoilsOnOffer {
  missing: number;
  onOffer: number;
}

/**
 * The cards printed in foil that the reader holds no foil of, as Master set counts them
 * (`finishesLacked`), and how many of those a sharing friend holds a foil of: for the empty
 * Missing view under Complete set, which points to them.
 */
export function foilsOnOffer(
  cards: readonly LorcanaCard[],
  you: CollectionEntries,
  friends: readonly SharingFriend[],
): FoilsOnOffer {
  const lacking = cards.filter((card) => finishesLacked(card, you, 'master').includes('foil'));
  const offered = lacking.filter((card) => friends.some((friend) => (friend.entries[card.id]?.foil ?? 0) > 0));
  return {missing: lacking.length, onOffer: offered.length};
}
