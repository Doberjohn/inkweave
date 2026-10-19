import {afterEach, describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {AccountCollection} from '../AccountCollection';

/*
 * The collection section's Clear deletes the imported collection from this browser and
 * from the account, with no undo, so it asks first. The providers are mocked: a reader
 * holding a collection, whose clear this file watches.
 */
const collection = vi.hoisted(() => ({clearImported: vi.fn()}));
vi.mock('../../features/collection/CollectionContext', () => ({
  useCollection: () => ({
    hasCollection: true,
    syncing: false,
    importCollection: vi.fn(),
    clearImported: collection.clearImported,
    ownedCount: () => 1,
    entries: {a: {normal: 1, foil: 0}},
    importedAt: Date.UTC(2026, 9, 12),
  }),
}));
vi.mock('../../features/collection/CollectionCardsContext', () => ({
  useCollectionCards: () => ({retry: vi.fn()}),
  useCollectionPool: () => ({pool: [], error: null, isReady: false}),
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));

afterEach(() => vi.clearAllMocks());

describe('AccountCollection', () => {
  it('asks before clearing, and clears only once the reader confirms', async () => {
    const user = userEvent.setup();
    render(<AccountCollection />);
    await user.click(screen.getByRole('button', {name: 'Clear'}));
    expect(collection.clearImported).not.toHaveBeenCalled();
    expect(screen.getByRole('alert')).toHaveTextContent('It cannot be undone.');

    await user.click(screen.getByRole('button', {name: 'Delete my collection'}));
    expect(collection.clearImported).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('keeps the collection when the reader cancels', async () => {
    const user = userEvent.setup();
    render(<AccountCollection />);
    await user.click(screen.getByRole('button', {name: 'Clear'}));
    await user.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(collection.clearImported).not.toHaveBeenCalled();
    expect(screen.getByRole('button', {name: 'Clear'})).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});
