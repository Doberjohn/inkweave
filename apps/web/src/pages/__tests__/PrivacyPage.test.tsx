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

// Every build the two flags make. Each check below holds in all four, and fewer can't pin a check
// that depends on both flags: a sentence shown with its flag unless the other is on too passes
// every one-flag build, and drops out of the all-on launch build.
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
// (#1045), which needs friends on too. The browser's copy outlives sign-out
// (`collectionStorage.ts`), and a clear removes both (`clearImported`).
const COLLECTION = (who: string) =>
  new RegExp(
    `\\. If you keep your collection on Inkweave, I store it with your account: how many copies of each card you own, normal and foil, so it’s there on any device you sign in on\\. ${who} A copy also stays in this browser, even after you sign out\\. Clearing your collection on your account page deletes both\\.`,
  );
const COLLECTION_SENTENCE = COLLECTION('Only you can see it\\.');
const SHARED_COLLECTION_SENTENCE = COLLECTION(
  'Only you can see it, unless you turn on sharing with friends on your account page\\. Then your friends can see which cards you own and how many\\.',
);
// The code is made and stored when the account page first loads, friends or not
// (`claim_friend_code`), so the sentence ties it to that visit. Each try at a code is logged
// against its sender (#860). A friend sees a collection only where both flags are on.
const FRIENDS = (sees: string) =>
  new RegExp(
    `\\. Opening your account page also gives you a friend code, which I store\\. If you add friends, I store who your friends and friend requests are\\. To stop anyone guessing codes, I also note when you try one\\. Your friends see ${sees}\\.`,
  );
const FRIENDS_SENTENCE = FRIENDS('your public name and handle');
const SHARED_FRIENDS_SENTENCE = FRIENDS('your public name and handle, and your collection if you share it with them');

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

  it.each(EVERY_BUILD)(
    'describes the collection only with its flag on (collection $collection, friends $friends)',
    (state) => {
      renderPolicy(state);
      expect(screen.queryByText(COLLECTION_SENTENCE) !== null).toBe(state.collection && !state.friends);
      expect(screen.queryByText(SHARED_COLLECTION_SENTENCE) !== null).toBe(state.collection && state.friends);
    },
  );

  it.each(EVERY_BUILD)(
    'describes friends only with its flag on (collection $collection, friends $friends)',
    (state) => {
      renderPolicy(state);
      expect(screen.queryByText(FRIENDS_SENTENCE) !== null).toBe(state.friends && !state.collection);
      expect(screen.queryByText(SHARED_FRIENDS_SENTENCE) !== null).toBe(state.friends && state.collection);
    },
  );
});
