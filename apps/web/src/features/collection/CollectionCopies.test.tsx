import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen, within} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {CollectionCopies, WindowCopies} from './CollectionCopies';
import {CollectionProvider} from './CollectionContext';
import {getCollection} from './collectionRepository';
import {writeCollection} from './collectionStorage';

/**
 * "Your copies" (#826): the block itself, and its wiring into the card window's slot
 * (`WindowCopies`). The window is stood in for by a bare slot element, which is all the
 * block ever sees of it; the modal's own side, the slot and the printing it reports, is
 * tested in `CardOverviewModal.test.tsx`.
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
  fullName: 'Elsa - Snow Queen',
  rarity: 'Legendary',
  variants: [{id: 'elsa-enchanted', rarity: 'Enchanted', number: 216}],
});

const mockModal = {
  copiesSlot: null as HTMLElement | null,
  selectedCardId: 'elsa' as string | null,
  shownPrintingId: null as string | null,
  resolveCard: null,
};
vi.mock('../../shared/contexts/CardModalContext', () => ({useCardModal: () => mockModal}));
vi.mock('../../shared/contexts/cardWindowSlot', () => ({
  useCardWindowSlot: () => ({slot: mockModal.copiesSlot, shownPrintingId: mockModal.shownPrintingId}),
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => (id === 'elsa' ? ELSA : undefined)}),
}));

/**
 * Browse's side, with the window open on Elsa: the block lands in the window's slot once the
 * account's copy has answered.
 */
async function renderInWindow() {
  render(
    <CollectionProvider>
      <WindowCopies />
    </CollectionProvider>,
  );
  await act(async () => {});
  return within(mockModal.copiesSlot!);
}

beforeEach(() => {
  localStorage.clear();
  mockSession.user = {id: 'user-a'};
  mockModal.copiesSlot = document.body.appendChild(document.createElement('div'));
  mockModal.shownPrintingId = null;
  writeCollection(HELD, 5000, 'user-a', 'server');
});
afterEach(() => mockModal.copiesSlot?.remove());

describe('CollectionCopies', () => {
  it('shows the copies held of the printing on show, per finish', async () => {
    const view = await renderInWindow();

    const copies = view.getByRole('group', {name: 'Your copies'});
    expect(within(copies).getByRole('group', {name: 'Normal'})).toHaveTextContent('2');
    expect(within(copies).getByRole('group', {name: 'Foil'})).toHaveTextContent('0');
  });

  it("adds a copy with its finish's +, kept in the collection", async () => {
    const user = userEvent.setup();
    const view = await renderInWindow();

    await user.click(view.getByRole('button', {name: 'Add one copy of foil Elsa - Snow Queen'}));

    expect(view.getByRole('group', {name: 'Foil'})).toHaveTextContent('1');
    expect(JSON.parse(localStorage.getItem('inkweave:collection')!).entries.elsa).toEqual({normal: 2, foil: 1});
  });

  it('greys a − at 0, which then changes nothing', async () => {
    const onChange = vi.fn();
    render(<CollectionCopies counts={{normal: 0, foil: 1}} cardName="Elsa" onChange={onChange} />);

    const minus = screen.getByRole('button', {name: 'Remove one copy of Elsa'});
    expect(minus).toHaveAttribute('aria-disabled', 'true');
    await userEvent.setup().click(minus);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers only the Foil count for a printing made only in foil, and says why', async () => {
    mockModal.shownPrintingId = 'elsa-enchanted';
    const view = await renderInWindow();

    expect(view.queryByRole('group', {name: 'Normal'})).toBeNull();
    expect(view.getByRole('group', {name: 'Foil'})).toHaveTextContent('1');
    expect(view.getByText('Enchanted cards are only printed in foil.')).toBeInTheDocument();
  });

  it('is not shown signed out, though this browser keeps the collection', async () => {
    mockSession.user = null;
    const view = await renderInWindow();

    expect(view.queryByRole('group', {name: 'Your copies'})).toBeNull();
  });

  it('is not shown without a collection, here or on the account', async () => {
    localStorage.clear();
    vi.mocked(getCollection).mockResolvedValueOnce({data: null, error: null});
    const view = await renderInWindow();

    expect(view.queryByRole('group', {name: 'Your copies'})).toBeNull();
  });

  it("waits for the account's copy, which an edit made before it answers would overwrite", async () => {
    vi.mocked(getCollection).mockImplementationOnce(() => new Promise(() => {}));
    const view = await renderInWindow();

    expect(view.queryByRole('group', {name: 'Your copies'})).toBeNull();
  });
});
