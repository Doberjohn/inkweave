import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {PrivacyPage} from '../PrivacyPage';

/*
 * The friends sentence (#852) shows only with the friends flag on, so the policy never
 * describes a feature that isn't there, and "Last updated" moves with it: the page promises
 * its date says when the text last changed. The flag is a module constant, so the mock
 * serves it through a getter each case sets.
 */
const flags = vi.hoisted(() => ({friends: false}));
vi.mock('../../features/friends/flag', () => ({
  get SHOW_FRIENDS() {
    return flags.friends;
  },
}));
// The header needs a session and the card data; the policy needs neither.
vi.mock('../../shared/components/CompactHeader', () => ({CompactHeader: () => <header />}));

afterEach(() => {
  flags.friends = false;
});

// The code is made and stored when the account page first loads, friends or not
// (`claim_friend_code`), so the sentence ties it to that visit.
const FRIENDS_SENTENCE =
  /Opening your account page also gives you a friend code, which I store\. If you add friends, I store who your friends and friend requests are\./;

function renderPolicy({friends}: {friends: boolean}) {
  flags.friends = friends;
  render(
    <MemoryRouter>
      <PrivacyPage />
    </MemoryRouter>,
  );
}

describe('PrivacyPage', () => {
  it('describes friends, and dates the change, with the friends flag on', () => {
    renderPolicy({friends: true});
    expect(screen.getByText(FRIENDS_SENTENCE)).toBeInTheDocument();
    expect(screen.getByText('Last updated: 21 October 2026')).toBeInTheDocument();
  });

  it('says neither with the flag off', () => {
    renderPolicy({friends: false});
    expect(screen.queryByText(FRIENDS_SENTENCE)).not.toBeInTheDocument();
    expect(screen.getByText('Last updated: 20 October 2026')).toBeInTheDocument();
  });
});
