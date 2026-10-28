import {describe, expect, it} from 'vitest';
import {createCard} from '../../shared/test-utils';
import type {CollectionEntries} from './collectionParser';
import type {SharingFriend} from './friendsCopies';
import {foilOnly, friendsFor, friendsHaveLine} from './friendsHave';

/** A Common, which comes in both finishes; an Enchanted comes in foil alone. */
const CARD = createCard({id: 'c', setCode: '9', rarity: 'Common'});
const ENCHANTED = createCard({id: 'e', setCode: '9', rarity: 'Enchanted', baseId: 'c'});

const friend = (name: string, entries: CollectionEntries): SharingFriend => ({
  id: name.toLowerCase(),
  name,
  handle: `${name.toLowerCase()}_1`,
  entries,
});
const ALBA = friend('Alba', {c: {normal: 2, foil: 0}});
const BRAN = friend('Bran', {c: {normal: 0, foil: 1}});
const CORA = friend('Cora', {c: {normal: 3, foil: 1}});
const DREW = friend('Drew', {});
const ALL = [ALBA, BRAN, CORA, DREW];

const names = ({friends}: {friends: {friend: SharingFriend}[]}) => friends.map((row) => row.friend.name);

describe('friendsFor', () => {
  it('lists the friends who hold the card, most copies first, for a reader who lacks it', () => {
    const has = friendsFor(CARD, {}, ALL, 'complete');
    expect(has.lacked).toEqual(['normal', 'foil']);
    expect(names(has)).toEqual(['Cora', 'Alba', 'Bran']);
    expect(has.friends[0]).toMatchObject({normal: 3, foil: 1});
  });

  it('breaks a tie in copies by name', () => {
    const twin = friend('Abel', {c: {normal: 1, foil: 1}});
    expect(names(friendsFor(CARD, {}, [ALBA, twin], 'complete'))).toEqual(['Abel', 'Alba']);
  });

  it('lists no one under Complete set for a reader who holds the card in either finish', () => {
    expect(friendsFor(CARD, {c: {normal: 0, foil: 1}}, ALL, 'complete')).toEqual({lacked: [], friends: []});
  });

  it('counts only the foil under Master set for a reader who holds the normal', () => {
    const has = friendsFor(CARD, {c: {normal: 1, foil: 0}}, ALL, 'master');
    expect(has.lacked).toEqual(['foil']);
    expect(names(has)).toEqual(['Bran', 'Cora']);
    expect(has.friends.every((row) => row.normal === 0)).toBe(true);
  });

  it('asks only for the foil of a printing that comes in foil alone', () => {
    const has = friendsFor(ENCHANTED, {}, [friend('Esme', {e: {normal: 0, foil: 2}})], 'master');
    expect(has.lacked).toEqual(['foil']);
    expect(has.friends).toMatchObject([{normal: 0, foil: 2}]);
  });
});

describe('foilOnly', () => {
  it('says when every copy on offer is a foil', () => {
    expect(foilOnly(friendsFor(CARD, {}, ALL, 'complete'))).toBe(false);
    expect(foilOnly(friendsFor(CARD, {c: {normal: 1, foil: 0}}, ALL, 'master'))).toBe(true);
  });
});

describe('friendsHaveLine', () => {
  const BOTH = ['normal', 'foil'] as const;

  it('counts the friends, one or many', () => {
    expect(friendsHaveLine(2, BOTH, BOTH)).toBe('2 friends have it');
    expect(friendsHaveLine(1, BOTH, BOTH)).toBe('1 friend has it');
  });

  it('names the finish when the reader lacks only one of the two the card comes in', () => {
    expect(friendsHaveLine(6, ['foil'], BOTH)).toBe('6 friends have the foil');
    expect(friendsHaveLine(1, ['foil'], ['foil'])).toBe('1 friend has it');
  });
});
