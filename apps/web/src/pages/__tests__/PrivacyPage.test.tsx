import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PrivacyPage} from '../PrivacyPage';

/*
 * The collection and friends sentences (#553, #852) show only with their flags on, so the
 * policy never describes a feature that isn't there. Everything else, the date included, is
 * the same on every build (#878): the page promises its date says when the text last changed,
 * and no flag flip can move it. The flags are module constants, so each mock serves its flag
 * through a getter each case sets.
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

// Every flag off, then every flag on: text that leaned on either flag would differ between them.
const SAME_EVERYWHERE: Flags[] = [
  {collection: false, friends: false},
  {collection: true, friends: true},
];
// One flag on, both ways round: a sentence that followed the other flag, or either flag, or
// only both, shows in the wrong one.
const ONE_FLAG_ON: Flags[] = [
  {collection: true, friends: false},
  {collection: false, friends: true},
];

// Every account claims a handle at its first sign-in (`claim_handle`), and anyone can read a
// profile that has one, so the sentence shows whatever the flags say.
const PROFILE_SENTENCE =
  /Your account also gets a made-up public name and handle, such as Emerald Princess 330, which anyone can see\. You can change the name\./;
// The account's row is readable only by its owner, the browser's copy outlives sign-out
// (`collectionStorage.ts`), and a clear removes both (`clearImported`).
const COLLECTION_SENTENCE =
  /If you keep your collection on Inkweave, I store it with your account: how many copies of each card you own, normal and foil, so it’s there on any device you sign in on\. Only you can see it\. A copy also stays in this browser, even after you sign out\. Clearing your collection on your account page deletes both\./;
// The code is made and stored when the account page first loads, friends or not
// (`claim_friend_code`), so the sentence ties it to that visit. Each try at a code is logged
// against its sender (#860).
const FRIENDS_SENTENCE =
  /Opening your account page also gives you a friend code, which I store\. If you add friends, I store who your friends and friend requests are\. To stop anyone guessing codes, I also note when you try one\. Your friends see your public name and handle\./;

function renderPolicy(state: Flags) {
  Object.assign(flags, state);
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage', () => {
  it.each(SAME_EVERYWHERE)(
    'says the same about signing in, and dates the page the same, with collection $collection and friends $friends',
    (state) => {
      renderPolicy(state);
      expect(
        screen.getByText(
          /Signing in with Google or Discord is only needed for the parts of Inkweave that use an account\./,
        ),
      ).toBeInTheDocument();
      expect(screen.queryByText(/only needed to save decks/)).not.toBeInTheDocument();
      expect(screen.getByText(PROFILE_SENTENCE)).toBeInTheDocument();
      expect(screen.getByText('Last updated: 26 October 2026')).toBeInTheDocument();
    },
  );

  it.each(ONE_FLAG_ON)(
    'describes the collection only with its flag on (collection $collection, friends $friends)',
    (state) => {
      renderPolicy(state);
      expect(screen.queryByText(COLLECTION_SENTENCE) !== null).toBe(state.collection);
    },
  );

  it.each(ONE_FLAG_ON)(
    'describes friends only with its flag on (collection $collection, friends $friends)',
    (state) => {
      renderPolicy(state);
      expect(screen.queryByText(FRIENDS_SENTENCE) !== null).toBe(state.friends);
    },
  );
});
