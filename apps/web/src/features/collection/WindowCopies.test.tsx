import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {WindowCopies} from './WindowCopies';
import type {HandCount} from './binderEvents';
import {CollectionProvider} from './CollectionContext';
import {getCollection} from './collectionRepository';
import {writeCollection} from './collectionStorage';

/**
 * The card window's copies stripe (#826): Browse's side of it, portalled into the window's slot.
 * The window is stood in for by a bare slot element, which is all this side ever sees of it; the
 * window's own side, the slot and the printing it reports, is `CardOverviewModal`'s.
 */

const mockSession = {user: {id: 'user-a'} as {id: string} | null, loading: false};
vi.mock('../../shared/contexts/SessionContext', () => ({useSession: () => mockSession}));

/** The collector's counts: the account's row, mirrored in this browser. */
const HELD = vi.hoisted(() => ({elsa: {normal: 2, foil: 0}, 'elsa-enchanted': {normal: 0, foil: 1}}));

/** Stubbed so no test reaches the network (see `CollectionContext.test.tsx`). */
vi.mock('./collectionRepository', () => ({
  getCollection: vi.fn(async () => ({data: {schemaVersion: 1, importedAt: 5000, entries: HELD}, error: null})),
  upsertCollection: vi.fn(async () => ({data: null, error: null})),
  deleteCollection: vi.fn(async () => ({data: null, error: null})),
}));

const ELSA: LorcanaCard = createCard({
  id: 'elsa',
  name: 'Elsa',
  version: 'Snow Queen',
  fullName: 'Elsa - Snow Queen',
  rarity: 'Legendary',
  variants: [
    {id: 'elsa-enchanted', rarity: 'Enchanted', number: 216},
    {id: 'elsa-promo', rarity: 'Special', number: 1, promoGrouping: 'C3', finishes: ['normal']},
    // A promo printed under another name, as Moana's European 26/P2 reads "Vaiana" (#891).
    {
      id: 'elsa-renamed',
      rarity: 'Special',
      number: 26,
      promoGrouping: 'P2',
      printedName: 'Queen Elsa',
    },
  ],
});

const mockWindow = {slot: null as HTMLElement | null, shownPrintingId: null as string | null, rowHeld: false};
vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({selectedCardId: 'elsa', resolveCard: null}),
}));
vi.mock('../../shared/contexts/cardWindowSlot', () => ({
  useCardWindowSlot: () => mockWindow,
  useHoldCopiesRow: (hold: boolean) => {
    mockWindow.rowHeld = hold;
  },
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => (id === 'elsa' ? ELSA : undefined)}),
}));

/** Browse's side, with the window open on Elsa: the stripe lands in the slot once the account's copy has answered. */
async function renderInWindow(onEdit: (edit: HandCount) => void = vi.fn()) {
  render(
    <CollectionProvider>
      <WindowCopies onEdit={onEdit} />
    </CollectionProvider>,
  );
  await act(async () => {});
  return within(mockWindow.slot!);
}

beforeEach(() => {
  localStorage.clear();
  mockSession.user = {id: 'user-a'};
  mockWindow.slot = document.body.appendChild(document.createElement('div'));
  mockWindow.shownPrintingId = null;
  mockWindow.rowHeld = false;
  writeCollection(HELD, 5000, 'user-a', 'server');
});
afterEach(() => {
  mockWindow.slot?.remove();
  vi.restoreAllMocks();
});

describe('WindowCopies', () => {
  it("lays the printing on show's copies in the row under the card, open, every finish named", async () => {
    const view = await renderInWindow();
    expect(view.getByRole('group', {name: 'Your copies: 2 normal, 0 foil'})).toBeInTheDocument();
    // Open: its buttons are in reach, not hidden as a resting pocket's are.
    expect(view.getByRole('button', {name: 'Add one copy of Elsa - Snow Queen'})).toHaveAttribute('tabindex', '0');
  });

  it("adds a copy with its finish's +, kept in the collection, and tells Browse the count and the copies before", async () => {
    const onEdit = vi.fn();
    const view = await renderInWindow(onEdit);

    await userEvent.setup().click(view.getByRole('button', {name: 'Add one copy of foil Elsa - Snow Queen'}));

    expect(view.getByRole('group', {name: 'Your copies: 2 normal, 1 foil'})).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('inkweave:collection')!).entries.elsa).toEqual({normal: 2, foil: 1});
    // So the binder behind the window keeps the card in its Owned or Missing view, and Browse counts it.
    expect(onEdit).toHaveBeenCalledExactlyOnceWith({cardId: 'elsa', finish: 'foil', count: 1, before: {normal: 2, foil: 0}});
  });

  it('tells Browse nothing of a count the browser refused to write, which stays as it was', async () => {
    const onEdit = vi.fn();
    const view = await renderInWindow(onEdit);
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('exceeded the quota', 'QuotaExceededError');
    });

    await userEvent.setup().click(view.getByRole('button', {name: 'Add one copy of foil Elsa - Snow Queen'}));

    expect(view.getByRole('group', {name: 'Your copies: 2 normal, 0 foil'})).toBeInTheDocument();
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('greys a − at 0, which then changes nothing', async () => {
    const onEdit = vi.fn();
    const view = await renderInWindow(onEdit);

    const minus = view.getByRole('button', {name: 'Remove one copy of foil Elsa - Snow Queen'});
    expect(minus).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup().click(minus);
    expect(onEdit).not.toHaveBeenCalled();
  });

  it('offers only the Foil count for a printing made only in foil, its own', async () => {
    mockWindow.shownPrintingId = 'elsa-enchanted';
    const view = await renderInWindow();

    expect(view.getByRole('group', {name: 'Your copies: 1 foil'})).toBeInTheDocument();
    expect(view.queryByRole('button', {name: 'Add one copy of Elsa - Snow Queen'})).toBeNull();
  });

  it('offers only the Normal count for a promo its data names in normal alone, as 1/C3 is (#880)', async () => {
    mockWindow.shownPrintingId = 'elsa-promo';
    const view = await renderInWindow();

    expect(view.getByRole('group', {name: 'Your copies: 0 normal'})).toBeInTheDocument();
    expect(view.queryByRole('button', {name: 'Add one copy of foil Elsa - Snow Queen'})).toBeNull();
  });

  it('names its buttons by the name printed on the printing on show (#891)', async () => {
    mockWindow.shownPrintingId = 'elsa-renamed';
    const view = await renderInWindow();

    const add = view.getByRole('button', {name: 'Add one copy of Queen Elsa - Snow Queen'});
    expect(add).toBeInTheDocument();
  });

  it('is not shown signed out, though this browser keeps the collection', async () => {
    mockSession.user = null;
    const view = await renderInWindow();

    // Still here, so the stripe hides for the signed-out reader, not for a missing collection.
    expect(localStorage.getItem('inkweave:collection')).not.toBeNull();
    expect(view.queryByRole('group')).toBeNull();
    // Nor is the row under the card held for it (owner, 2026-10-22).
    expect(mockWindow.rowHeld).toBe(false);
  });

  it('is not shown without a collection, here or on the account', async () => {
    localStorage.clear();
    vi.mocked(getCollection).mockResolvedValueOnce({data: null, error: null});
    const view = await renderInWindow();

    expect(view.queryByRole('group')).toBeNull();
  });

  it("waits for the account's copy, which an edit made before it answers would overwrite", async () => {
    vi.mocked(getCollection).mockImplementationOnce(() => new Promise(() => {}));
    const view = await renderInWindow();

    expect(view.queryByRole('group')).toBeNull();
    // The row under the card is already held, so the stripe arriving moves nothing.
    expect(mockWindow.rowHeld).toBe(true);
  });
});
