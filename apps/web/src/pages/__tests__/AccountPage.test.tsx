import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AccountPage} from '../AccountPage';

// The collection and friends sections are modules of their own, each with its own tests
// (AccountPage.collection.test.tsx, AccountPage.friends.test.tsx); stubbed here, the page's
// own parts are under test.
vi.mock('../AccountCollection', () => ({AccountCollection: () => <h2>Collection</h2>}));
vi.mock('../AccountFriends', () => ({AccountFriends: () => <h2>Friends</h2>}));
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: {id: 'user-1'}, loading: false, signOut: vi.fn()}),
}));
vi.mock('../../features/profile', async () => {
  const actual = await vi.importActual('../../features/profile');
  return {
    ...actual,
    useProfile: () => ({identity: {handle: 'tester', displayName: 'Tester'}, adoptDisplayName: vi.fn()}),
  };
});
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {...actual, CompactHeader: () => <header data-testid="compact-header" />};
});

describe('AccountPage', () => {
  it('renders Identity, Friends, Collection and Session for a signed-in player', async () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('heading', {name: 'Identity'})).toBeInTheDocument();
    const headings = screen.getAllByRole('heading').map((heading) => heading.textContent);
    expect(headings.filter((name) => ['Identity', 'Friends', 'Collection', 'Session'].includes(name ?? ''))).toEqual([
      'Identity',
      'Friends',
      'Collection',
      'Session',
    ]);
  });

  it('opens the display-name dialog from the pencil after the name', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await user.click(await screen.findByRole('button', {name: 'Change display name'}));
    expect(await screen.findByRole('dialog', {name: 'Change your display name'})).toBeInTheDocument();
  });
});
