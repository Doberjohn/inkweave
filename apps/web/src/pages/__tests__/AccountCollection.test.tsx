import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter, Route, Routes, useLocation} from 'react-router-dom';
import {trackEvent} from '../../shared/lib/analytics';
import {AccountCollection} from '../AccountCollection';

/*
 * The collection section's Clear deletes the imported collection from this browser and
 * from the account, with no undo, so it asks first. The providers are mocked: a reader
 * holding a collection, whose clear this file watches.
 */
const collection = vi.hoisted(() => ({
  clearImported: vi.fn(),
  startCollection: vi.fn(),
  importedAt: Date.UTC(2026, 9, 12),
  has: true,
}));
vi.mock('../../features/collection/CollectionContext', () => ({
  useCollection: () => ({
    hasCollection: collection.has,
    holdsCopies: collection.has,
    syncing: false,
    importCollection: vi.fn(),
    startCollection: collection.startCollection,
    clearImported: collection.clearImported,
    // One card owned; `b` is an entry at no copies, which the owned count leaves out.
    ownedCount: (id: string) => (id === 'a' ? 1 : 0),
    entries: {a: {normal: 1, foil: 0}, b: {normal: 0, foil: 0}},
    importedAt: collection.importedAt,
  }),
}));
vi.mock('../../features/collection/CollectionCardsContext', () => ({
  useCollectionCards: () => ({retry: vi.fn()}),
  useCollectionPool: () => ({pool: [], error: null, isReady: false}),
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));
vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
vi.mock('../../shared/contexts/SessionContext', () => ({
  useSession: () => ({user: {id: 'reader'}, loading: false}),
}));
// Sharing with friends (#1045): its switch shows only with friends on, and reads the saved state.
const sharing = vi.hoisted(() => ({friends: false, saved: false}));
vi.mock('../../features/friends/flag', () => ({
  get SHOW_FRIENDS() {
    return sharing.friends;
  },
}));
vi.mock('../../features/collection/sharingRepository', () => ({
  getSharing: vi.fn(() => Promise.resolve({data: sharing.saved, error: null})),
  setSharing: vi.fn(() => Promise.resolve({data: null, error: null})),
}));

// Open your binder goes to Browse, through the router.
const renderAccount = () => render(<AccountCollection />, {wrapper: MemoryRouter});

afterEach(() => {
  vi.clearAllMocks();
  collection.has = true;
  sharing.friends = false;
  sharing.saved = false;
});

describe('AccountCollection', () => {
  it('dates the collection by its last change, which an import and each edit in the app stamp (#826)', () => {
    renderAccount();
    // The copy's own stamp, formatted as the row formats it: in the machine's locale, so
    // a fixed string would fail outside English, but a wrong stamp still fails.
    const lastChanged = new Date(collection.importedAt).toLocaleDateString(undefined, {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
    expect(screen.getByText('Last changed').nextSibling).toHaveTextContent(lastChanged);
    expect(screen.queryByText('Imported')).not.toBeInTheDocument();
  });

  it('asks before clearing, and clears only once the reader confirms', async () => {
    const user = userEvent.setup();
    renderAccount();
    await user.click(screen.getByRole('button', {name: 'Clear'}));
    expect(collection.clearImported).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('It cannot be undone.');

    await user.click(screen.getByRole('button', {name: 'Delete my collection'}));
    expect(collection.clearImported).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('sends the owned count once the reader confirms the delete', async () => {
    const user = userEvent.setup();
    renderAccount();
    await user.click(screen.getByRole('button', {name: 'Clear'}));
    expect(trackEvent).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', {name: 'Delete my collection'}));
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('collection_deleted', {cards: 1});
  });

  it('keeps the collection when the reader cancels', async () => {
    const user = userEvent.setup();
    renderAccount();
    await user.click(screen.getByRole('button', {name: 'Clear'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(collection.clearImported).not.toHaveBeenCalled();
    expect(trackEvent).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Clear'})).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('has no sharing switch while friends are off', () => {
    renderAccount();
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
  });

  it('shows the sharing switch as saved, and says Clear turns it off while it is on (#1045)', async () => {
    sharing.friends = true;
    sharing.saved = true;
    const user = userEvent.setup();
    renderAccount();
    const toggle = screen.getByRole('switch', {name: 'Let my friends see my collection'});
    await waitFor(() => expect(toggle).toHaveAttribute('aria-checked', 'true'));

    await user.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.getByRole('alert')).toHaveTextContent('Sharing with your friends turns off too.');
  });

  it("leaves Clear's line as it was while sharing is off", async () => {
    sharing.friends = true;
    const user = userEvent.setup();
    renderAccount();
    await waitFor(() => expect(screen.getByRole('switch')).toBeEnabled());

    await user.click(screen.getByRole('button', {name: 'Clear'}));
    expect(screen.getByRole('alert')).not.toHaveTextContent('Sharing');
  });

  it('opens an empty binder on Browse for an account with nothing to import', async () => {
    collection.has = false;
    const user = userEvent.setup();
    render(
      <MemoryRouter initialEntries={['/account']}>
        <Routes>
          <Route path="/account" element={<AccountCollection />} />
          <Route path="/browse" element={<Where />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', {name: 'Import collection'})).toBeInTheDocument();
    await user.click(screen.getByRole('button', {name: 'Open your binder'}));
    expect(collection.startCollection).toHaveBeenCalledWith('account');
    expect(screen.getByTestId('where')).toHaveTextContent('/browse?binder=all');
  });

  it('offers no Open your binder once there is a collection', () => {
    renderAccount();
    expect(screen.queryByRole('button', {name: 'Open your binder'})).toBeNull();
  });
});

function Where() {
  const {pathname, search} = useLocation();
  return <output data-testid="where">{pathname + search}</output>;
}
