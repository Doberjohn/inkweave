import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {AccountPage} from '../AccountPage';

/*
 * The FLAG-OFF shape, which is what production ships until collection launches
 * (#553 Phase C). No collection provider is mounted below: if the page called a
 * collection hook with the flag off, this render would throw.
 *
 * The flag is stubbed OFF explicitly, and hoisted so it lands before the page's
 * module-level constant is read. Vitest loads `.env.local`, so a developer running
 * with the flag on would otherwise test the flag-ON page here and pass for the
 * wrong reason, while CI (no `.env.local`) tested the other one.
 */
vi.hoisted(() => {
  vi.stubEnv('VITE_SHOW_COLLECTION', 'false');
});
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

describe('AccountPage with the collection flag off', () => {
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
});
