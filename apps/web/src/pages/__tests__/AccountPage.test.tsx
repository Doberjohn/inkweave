import {afterAll, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router-dom';
import {AccountPage} from '../AccountPage';

/*
 * The FLAG-OFF shape, which is what production ships until collection and friends
 * launch (#553 Phase C, #852). No collection provider is mounted below: if the page
 * called a collection hook with the flag off, this render would throw.
 *
 * The flags are stubbed OFF explicitly, and hoisted so they land before the page's
 * module-level constants are read. Vitest loads `.env.local`, so a developer running
 * with a flag on would otherwise test the flag-ON page here and pass for the wrong
 * reason, while CI (no `.env.local`) tested the other one.
 */
vi.hoisted(() => {
  vi.stubEnv('VITE_SHOW_COLLECTION', 'false');
  vi.stubEnv('VITE_SHOW_FRIENDS', 'false');
});
// Restored after the file, so the stub cannot reach a later test file in the same worker.
afterAll(() => vi.unstubAllEnvs());
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

describe('AccountPage with the collection and friends flags off', () => {
  it('renders the account without a collection section, and without its providers', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('heading', {name: 'Identity'})).toBeInTheDocument();
    expect(screen.queryByRole('heading', {name: 'Collection'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Import collection'})).not.toBeInTheDocument();
  });

  it('renders no Friends section', () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.queryByRole('heading', {name: 'Friends'})).not.toBeInTheDocument();
  });

  it('opens the display-name dialog from the pencil after the name', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', {name: 'Change display name'}));
    expect(await screen.findByRole('dialog', {name: 'Change your display name'})).toBeInTheDocument();
  });
});
