import {afterAll, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {AccountPage} from '../AccountPage';

/*
 * The FLAG-ON page (#852), whose Friends section is a module of its own, loaded lazily
 * inside the boundary every section shares, so it arrives with the others, between
 * Identity and Collection, rather than landing late and pushing them down.
 *
 * Both lazy modules are stubbed (the real ones need a session and their data layers), and
 * the friends one waits on a gate this test opens, so "still loading" is a state the test
 * holds rather than a race against the import.
 */
const gate = vi.hoisted(() => {
  let open = () => {};
  const loaded = new Promise<void>((resolve) => {
    open = resolve;
  });
  return {loaded, open: () => open()};
});
vi.hoisted(() => {
  vi.stubEnv('VITE_SHOW_FRIENDS', 'true');
  vi.stubEnv('VITE_SHOW_COLLECTION', 'true');
  vi.stubEnv('VITE_SHOW_ACCOUNTS', 'true');
});
// Restored after the file, so the stubs cannot reach a later test file in the same worker.
afterAll(() => vi.unstubAllEnvs());
vi.mock('../AccountFriends', async () => {
  await gate.loaded;
  return {AccountFriends: ({userId}: {userId: string}) => <h2>Friends of {userId}</h2>};
});
vi.mock('../AccountCollection', () => ({AccountCollection: () => <h2>Collection stub</h2>}));
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

describe('AccountPage with the friends flag on', () => {
  it("brings the player's Friends section in with the others, between Identity and Collection", async () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    // Held back with the friends module, not drawn around its fallback.
    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Identity'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Sign out'})).not.toBeInTheDocument();

    gate.open();

    expect(await screen.findByRole('heading', {name: 'Friends of user-1'})).toBeInTheDocument();
    expect(screen.getAllByRole('heading', {level: 2}).map((heading) => heading.textContent)).toEqual([
      'Identity',
      'Friends of user-1',
      'Collection stub',
      'Session',
    ]);
  });
});
