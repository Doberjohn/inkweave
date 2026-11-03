import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PrivacyPage} from '../PrivacyPage';

// The header needs a session and the card data; the policy needs neither.
vi.mock('../../shared/components/CompactHeader', () => ({CompactHeader: () => <header />}));

// Every account claims a handle at its first sign-in (`claim_handle`), and anyone can read a
// profile that has one, so the sentence shows for everyone.
const PROFILE_SENTENCE =
  /Your account also gets a made-up public name and handle, such as Emerald Princess 330, which anyone can see\. You can change the name\./;
// The two feature matchers start at the full stop before their sentence, so a lost space between
// the sentences fails them too.
// The account's row is readable only by its owner, unless they share it with their friends
// (#1045). The browser's copy outlives sign-out (`collectionStorage.ts`), and a clear removes
// both (`clearImported`).
const COLLECTION_SENTENCE =
  /\. If you keep your collection on Inkweave, I store it with your account: how many copies of each card you own, normal and foil, so it’s there on any device you sign in on\. Only you can see it, unless you turn on sharing with friends on your account page\. Then your friends can see which cards you own and how many\. A copy also stays in this browser, even after you sign out\. Clearing your collection on your account page deletes both\./;
// The code is made and stored the first time the Friends section asks for it (`useFriends` calls
// `claim_friend_code`), never at sign-up, so the sentence ties the code to that section. Each try
// at a code is logged against its sender (#860).
const FRIENDS_SENTENCE =
  /\. Your account page’s Friends section gives you a friend code the first time it opens, which I store\. If you add friends, I store who your friends and friend requests are\. To stop anyone guessing codes, I also note when you try one\. Your friends see your public name and handle, and your collection if you share it with them\./;

function renderPolicy() {
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage', () => {
  it('says what signing in is for, and dates the page the launch day', () => {
    renderPolicy();
    expect(
      screen.getByText(/Signing in with Google or Discord is only needed for the parts of Inkweave that use an account\./),
    ).toBeInTheDocument();
    expect(screen.queryByText(/only needed to save decks/)).not.toBeInTheDocument();
    expect(screen.getByText(PROFILE_SENTENCE)).toBeInTheDocument();
    expect(screen.getByText('Last updated: 2 November 2026')).toBeInTheDocument();
  });

  it('describes the collection and friends', () => {
    renderPolicy();
    expect(screen.getByText(COLLECTION_SENTENCE)).toBeInTheDocument();
    expect(screen.getByText(FRIENDS_SENTENCE)).toBeInTheDocument();
  });
});
