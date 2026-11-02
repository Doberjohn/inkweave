import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PrivacyPage} from '../PrivacyPage';

/*
 * The policy reads the same on every build (#878): the collection and friends keep their data in
 * the database whatever the flags say, so no flag may hide the sentences that describe it, and the
 * page promises its date says when the text last changed, which no flag flip can move. The page
 * imports neither flag; the mocks serve each build's values anyway, so a condition put back on
 * either sentence fails here. The flags are module constants, so each mock serves its flag through
 * a getter each case sets.
 */
const flags = vi.hoisted(() => ({collection: false, friends: false}));
vi.mock('../../features/collection/flag', () => ({
  get SHOW_COLLECTION() {
    return flags.collection;
  },
}));
vi.mock('../../features/friends/flag', () => ({
  get SHOW_FRIENDS() {
    return flags.friends;
  },
}));
// The header needs a session and the card data; the policy needs neither.
vi.mock('../../shared/components/CompactHeader', () => ({CompactHeader: () => <header />}));

afterEach(() => {
  flags.collection = false;
  flags.friends = false;
});

type Flags = typeof flags;

// Every build the two flags make. A sentence hidden with one flag off, or only where the other is
// on too, drops out of at least one of them.
const EVERY_BUILD: Flags[] = [
  {collection: false, friends: false},
  {collection: true, friends: false},
  {collection: false, friends: true},
  {collection: true, friends: true},
];

// Every account claims a handle at its first sign-in (`claim_handle`), and anyone can read a
// profile that has one, so the sentence shows whatever the flags say.
const PROFILE_SENTENCE =
  /Your account also gets a made-up public name and handle, such as Emerald Princess 330, which anyone can see\. You can change the name\./;
// The two feature matchers start at the full stop before their sentence, so a lost space between
// the sentences fails them too.
// The account's row is readable only by its owner, unless they share it with their friends
// (#1045). The browser's copy outlives sign-out (`collectionStorage.ts`), and a clear removes
// both (`clearImported`).
const COLLECTION_SENTENCE =
  /\. If you keep your collection on Inkweave, I store it with your account: how many copies of each card you own, normal and foil, so it’s there on any device you sign in on\. Only you can see it, unless you turn on sharing with friends on your account page\. Then your friends can see which cards you own and how many\. A copy also stays in this browser, even after you sign out\. Clearing your collection on your account page deletes both\./;
// The code is made and stored when the account page first loads, friends or not
// (`claim_friend_code`), so the sentence ties it to that visit. Each try at a code is logged
// against its sender (#860).
const FRIENDS_SENTENCE =
  /\. Opening your account page also gives you a friend code, which I store\. If you add friends, I store who your friends and friend requests are\. To stop anyone guessing codes, I also note when you try one\. Your friends see your public name and handle, and your collection if you share it with them\./;

function renderPolicy(state: Flags) {
  Object.assign(flags, state);
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage', () => {
  it.each(EVERY_BUILD)(
    'says the same about signing in, and dates the page the launch day, with collection $collection and friends $friends',
    (state) => {
      renderPolicy(state);
      expect(
        screen.getByText(
          /Signing in with Google or Discord is only needed for the parts of Inkweave that use an account\./,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/only needed to save decks/)).not.toBeInTheDocument();
      expect(screen.getByText(PROFILE_SENTENCE)).toBeInTheDocument();
      expect(screen.getByText('Last updated: 2 November 2026')).toBeInTheDocument();
    },
  );

  it.each(EVERY_BUILD)(
    'describes the collection and friends whatever the flags say (collection $collection, friends $friends)',
    (state) => {
      renderPolicy(state);
      expect(screen.getByText(COLLECTION_SENTENCE)).toBeInTheDocument();
      expect(screen.getByText(FRIENDS_SENTENCE)).toBeInTheDocument();
    },
  );
});
