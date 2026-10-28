import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import {act, fireEvent, render, screen, waitFor, within} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import {createCard} from '../../shared/test-utils';
import {trackEvent} from '../../shared/lib/analytics';
import {CollectionProvider} from './CollectionContext';
import {writeCollection} from './collectionStorage';
import type {FriendsCopies, SharingFriend} from './friendsCopies';
import {CollectionFriends, FoilPointer, PocketFriends} from './CollectionFriends';

/**
 * Friends who have it, Browse's side: the card window's count, portalled into the
 * window's friends slot, which a bare element stands in for here; a pocket's badge; the foil
 * pointer; and the one dialog they open.
 */

vi.mock('../../shared/lib/analytics', () => ({trackEvent: vi.fn()}));
const mockSession = {user: {id: 'me'} as {id: string} | null, loading: false};
vi.mock('../../shared/contexts/SessionContext', () => ({useSession: () => mockSession}));
vi.mock('./collectionRepository', () => ({
  getCollection: vi.fn(async () => ({data: {schemaVersion: 1, importedAt: 5000, entries: HELD}, error: null})),
  upsertCollection: vi.fn(async () => ({data: null, error: null})),
  deleteCollection: vi.fn(async () => ({data: null, error: null})),
}));

/** The reader holds Mulan in normal and lacks Elsa. */
const HELD = vi.hoisted(() => ({mulan: {normal: 1, foil: 0}}));
const ELSA: LorcanaCard = createCard({id: 'elsa', name: 'Elsa', fullName: 'Elsa - Snow Queen', setCode: '9', rarity: 'Rare'});
const MULAN: LorcanaCard = createCard({id: 'mulan', name: 'Mulan', fullName: 'Mulan - Warrior', setCode: '9', rarity: 'Rare'});

const mockModal = vi.hoisted(() => ({selectedCardId: 'elsa' as string | null, closeCardModal: vi.fn()}));
vi.mock('../../shared/contexts/CardModalContext', () => ({useCardModal: () => ({...mockModal, resolveCard: null})}));
const mockWindow = {friendsSlot: null as HTMLElement | null, shownPrintingId: null as string | null};
vi.mock('../../shared/contexts/cardWindowSlot', () => ({useCardWindowSlot: () => mockWindow}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => [ELSA, MULAN].find((card) => card.id === id)}),
}));
const mockCopies = vi.hoisted(() => ({value: {status: 'idle'} as FriendsCopies, calls: [] as [boolean, boolean][]}));
vi.mock('./friendsCopies', () => ({
  useFriendsCopies: (enabled: boolean, need: boolean) => {
    mockCopies.calls.push([enabled, need]);
    return mockCopies.value;
  },
}));

const sharing = (name: string, entries: SharingFriend['entries']): SharingFriend => ({
  id: name,
  name,
  handle: name.toLowerCase().replaceAll(' ', '_'),
  entries,
});
const RUBY = sharing('Ruby Hero 042', {elsa: {normal: 2, foil: 0}, mulan: {normal: 0, foil: 1}});
const EMERALD = sharing('Emerald Fairy 913', {elsa: {normal: 0, foil: 1}});
const ready = (friends: SharingFriend[]): FriendsCopies => ({status: 'ready', sharing: friends, notSharing: []});

const inWindow = (axis: 'complete' | 'master' = 'complete') => (
  <MemoryRouter>
    <CollectionProvider>
      <CollectionFriends axis={axis} />
    </CollectionProvider>
  </MemoryRouter>
);

async function renderInWindow(axis: 'complete' | 'master' = 'complete') {
  render(inWindow(axis));
  await act(async () => {});
  return within(mockWindow.friendsSlot!);
}

beforeEach(() => {
  localStorage.clear();
  mockSession.user = {id: 'me'};
  mockModal.selectedCardId = 'elsa';
  mockWindow.friendsSlot = document.body.appendChild(document.createElement('div'));
  mockWindow.shownPrintingId = null;
  mockCopies.value = ready([RUBY, EMERALD]);
  mockCopies.calls = [];
  writeCollection(HELD, 5000, 'me', 'server');
});
afterEach(() => {
  mockWindow.friendsSlot?.remove();
  vi.clearAllMocks();
});

describe('CollectionFriends, the window\'s count', () => {
  it('counts the friends who have a card the reader lacks, in the window', async () => {
    const slot = await renderInWindow();
    expect(slot.getByRole('button', {name: '2 friends have it'})).toHaveAttribute('aria-haspopup', 'dialog');
  });

  it('opens Friends who have it, and counts where it was opened from', async () => {
    const slot = await renderInWindow();
    fireEvent.click(slot.getByRole('button', {name: '2 friends have it'}));
    expect(screen.getByRole('dialog', {name: 'Friends who have it'})).toBeInTheDocument();
    expect(trackEvent).toHaveBeenCalledWith('friends_who_have_it_opened', {from: 'window'});
  });

  it('shows nothing on a card the reader holds under Complete set', async () => {
    mockModal.selectedCardId = 'mulan';
    const slot = await renderInWindow();
    expect(slot.queryByRole('button')).toBeNull();
  });

  it('counts the foil under Master set, in gold when every copy on offer is a foil', async () => {
    mockModal.selectedCardId = 'mulan';
    const slot = await renderInWindow('master');
    const count = slot.getByRole('button', {name: '1 friend has the foil'});
    expect(count.style.backgroundImage).toContain('linear-gradient');
  });

  it('closes the card window when a row opens a friend\'s binder', async () => {
    const slot = await renderInWindow();
    fireEvent.click(slot.getByRole('button', {name: '2 friends have it'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Friends who have it'})).getAllByRole('link')[0]);
    expect(mockModal.closeCardModal).toHaveBeenCalledTimes(1);
  });

  it('closes Friends who have it when a re-read leaves no friend with the card, so it never reopens alone', async () => {
    const view = render(inWindow());
    await act(async () => {});
    const slot = within(mockWindow.friendsSlot!);
    fireEvent.click(slot.getByRole('button', {name: '2 friends have it'}));
    mockCopies.value = ready([]);
    view.rerender(inWindow());
    mockCopies.value = ready([RUBY, EMERALD]);
    view.rerender(inWindow());
    expect(slot.getByRole('button', {name: '2 friends have it'})).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Friends who have it'})).toBeNull());
  });

  it('closes Friends who have it while the copies are read again, so it never reopens alone', async () => {
    const view = render(inWindow());
    await act(async () => {});
    const slot = within(mockWindow.friendsSlot!);
    fireEvent.click(slot.getByRole('button', {name: '2 friends have it'}));
    mockCopies.value = {status: 'loading'};
    view.rerender(inWindow());
    mockCopies.value = ready([RUBY, EMERALD]);
    view.rerender(inWindow());
    expect(slot.getByRole('button', {name: '2 friends have it'})).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Friends who have it'})).toBeNull());
  });

  it('says a failed read on a card the reader lacks, with a retry', async () => {
    const retry = vi.fn();
    mockCopies.value = {status: 'failed', retry};
    const slot = await renderInWindow();
    expect(slot.getByText('Couldn’t load friends’ copies')).toBeInTheDocument();
    fireEvent.click(slot.getByRole('button', {name: 'Retry'}));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('keeps a failed read quiet on a card the reader holds, where no friend could add one', async () => {
    mockCopies.value = {status: 'failed', retry: vi.fn()};
    mockModal.selectedCardId = 'mulan';
    const slot = await renderInWindow();
    expect(slot.queryByText('Couldn’t load friends’ copies')).toBeNull();
  });

  it('asks for no friends while signed out', async () => {
    mockSession.user = null;
    const slot = await renderInWindow();
    expect(slot.queryByRole('button')).toBeNull();
    expect(mockCopies.calls.every(([enabled]) => !enabled)).toBe(true);
  });

  it('reads the friends before any window opens, so a window opens with its count in place', async () => {
    mockModal.selectedCardId = null;
    const slot = await renderInWindow();
    expect(mockCopies.calls.at(-1)).toEqual([true, true]);
    expect(slot.queryByRole('button')).toBeNull();
  });
});

const inBinder = (card: LorcanaCard, axis: 'complete' | 'master' = 'complete') => (
  <MemoryRouter>
    <CollectionProvider>
      <CollectionFriends axis={axis} />
      <PocketFriends card={card} axis={axis} />
    </CollectionProvider>
  </MemoryRouter>
);

async function renderInBinder(card: LorcanaCard, axis: 'complete' | 'master' = 'complete') {
  mockModal.selectedCardId = null;
  const view = render(inBinder(card, axis));
  await act(async () => {});
  return view;
}

describe('PocketFriends', () => {
  it('badges a card friends have for the reader, named as the window counts it, out of the Tab order', async () => {
    await renderInBinder(ELSA);
    const badge = screen.getByRole('button', {name: '2 friends have it'});
    expect(badge).toHaveTextContent('2');
    expect(badge).toHaveAttribute('tabindex', '-1');
    expect(badge).toHaveAttribute('data-no-grab');
    expect(badge.style.backgroundImage).not.toContain('linear-gradient');
  });

  it('badges no card the reader holds under Complete set', async () => {
    await renderInBinder(MULAN);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('badges nothing before the friends\' copies are in', async () => {
    mockCopies.value = {status: 'loading'};
    await renderInBinder(ELSA);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('turns gold under Master set over a card held in normal, when every copy on offer is a foil', async () => {
    await renderInBinder(MULAN, 'master');
    expect(screen.getByRole('button', {name: '1 friend has the foil'}).style.backgroundImage).toContain('linear-gradient');
  });

  it('opens Friends who have it for its card, counted as from a badge', async () => {
    await renderInBinder(ELSA);
    fireEvent.click(screen.getByRole('button', {name: '2 friends have it'}));
    const dialog = screen.getByRole('dialog', {name: 'Friends who have it'});
    expect(within(dialog).getByText("You're missing it")).toBeInTheDocument();
    expect(within(dialog).getAllByRole('link').map((link) => link.getAttribute('href'))).toEqual([
      '/browse?binder=9&friend=ruby_hero_042',
      '/browse?binder=9&friend=emerald_fairy_913',
    ]);
    expect(trackEvent).toHaveBeenCalledWith('friends_who_have_it_opened', {from: 'badge'});
  });

  it('opens and counts nothing with no Friends who have it mounted to open', async () => {
    mockModal.selectedCardId = null;
    render(
      <MemoryRouter>
        <CollectionProvider>
          <PocketFriends card={ELSA} axis="complete" />
        </CollectionProvider>
      </MemoryRouter>,
    );
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', {name: '2 friends have it'}));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(trackEvent).not.toHaveBeenCalled();
  });

  it('leaves the card window alone when a row it opened is followed', async () => {
    await renderInBinder(ELSA);
    fireEvent.click(screen.getByRole('button', {name: '2 friends have it'}));
    fireEvent.click(within(screen.getByRole('dialog', {name: 'Friends who have it'})).getAllByRole('link')[0]);
    await waitFor(() => expect(screen.queryByRole('dialog', {name: 'Friends who have it'})).toBeNull());
    expect(mockModal.closeCardModal).not.toHaveBeenCalled();
  });
});

describe('FoilPointer', () => {
  const pointer = (onShow = vi.fn()) => (
    <MemoryRouter>
      <CollectionProvider>
        <FoilPointer cards={[ELSA, MULAN]} onShow={onShow} />
      </CollectionProvider>
    </MemoryRouter>
  );

  it('counts the foils the reader lacks that friends have, of those they lack', async () => {
    // Elsa: no foil held, none offered (Ruby has her normal). Mulan: normal held, Ruby has the foil.
    mockCopies.value = ready([RUBY]);
    render(pointer());
    await act(async () => {});
    expect(screen.getByText("Your friends have 1 of the 2 foils you're missing.")).toBeInTheDocument();
  });

  it('picks Master set from Show them under Master set', async () => {
    const onShow = vi.fn();
    render(pointer(onShow));
    await act(async () => {});
    fireEvent.click(screen.getByRole('button', {name: 'Show them under Master set'}));
    expect(onShow).toHaveBeenCalledTimes(1);
  });

  it('says nothing while no friend has a foil the reader lacks', async () => {
    mockCopies.value = ready([sharing('Amber Sage 7', {elsa: {normal: 3, foil: 0}})]);
    render(pointer());
    await act(async () => {});
    expect(screen.queryByText(/Your friends have/)).toBeNull();
  });
});
