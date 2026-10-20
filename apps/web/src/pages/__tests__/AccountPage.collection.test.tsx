import {afterAll, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {AccountPage} from '../AccountPage';

/*
 * The FLAG-ON page (#553 Phase C), whose collection section is a module of its own,
 * loaded lazily. It must arrive with the other sections, not after them: landing late
 * between Identity and Session, it pushed Session down under the reader.
 *
 * The collection module is stubbed (its hooks need both collection providers), and its
 * load waits on a gate this test opens, so "still loading" is a state the test holds
 * rather than a race against the import.
 */
const gate = vi.hoisted(() => {
  let open = () => {};
  const loaded = new Promise<void>((resolve) => {
    open = resolve;
  });
  return {loaded, open: () => open()};
});
vi.hoisted(() => {
  vi.stubEnv('VITE_SHOW_COLLECTION', 'true');
  vi.stubEnv('VITE_SHOW_ACCOUNTS', 'true');
  // Off, so a `.env.local` with friends on can't load the real section, and its calls, here.
  vi.stubEnv('VITE_SHOW_FRIENDS', 'false');
});
// Restored after the file, so the stubs cannot reach a later test file in the same worker.
afterAll(() => vi.unstubAllEnvs());
vi.mock('../AccountCollection', async () => {
  await gate.loaded;
  return {AccountCollection: () => <h2>Collection stub</h2>};
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

describe('AccountPage with the collection flag on', () => {
  it('holds every section back until the collection has loaded, so none lands late', async () => {
    render(
      <MemoryRouter>
        <AccountPage />
      </MemoryRouter>,
    );
    expect(screen.getByText('Checking your session…')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Sign out'})).not.toBeInTheDocument();

    gate.open();

    expect(await screen.findByRole('heading', {name: 'Collection stub'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Identity'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Sign out'})).toBeInTheDocument();
  });
});
