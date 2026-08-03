import {describe, it, expect, beforeEach, afterEach, vi} from 'vitest';
import {renderHook, act} from '@testing-library/react';
import type {ReactNode} from 'react';
import {DeckProvider, useDeck} from './DeckContext';
import {readDraft, writeDraft} from './deckStorage';
import {createCard} from '../../../shared/test-utils';
import type {Deck, LorcanaCard} from '../types';

// DeckProvider needs `getCardById` + `isLoading`; inject fixtures instead of loading the DB.
// `mockCtl.loading` lets a test simulate the card DB still fetching (getCardById -> undefined).
const fixtureCards = vi.hoisted(() => new Map<string, LorcanaCard>());
const mockCtl = vi.hoisted(() => ({loading: false}));
vi.mock('../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({
    getCardById: (id: string) => (mockCtl.loading ? undefined : fixtureCards.get(id)),
    isLoading: mockCtl.loading,
  }),
}));

// DeckProvider reads useSession for the first-sign-in cloud migrator (#464) and the
// sign-out draft clear (#473). Defaults to signed out — the migrator returns early and
// nothing touches Supabase — while `sessionCtl.userId` lets a test drive a sign-out.
const sessionCtl = vi.hoisted(() => ({userId: null as string | null}));
vi.mock('../../../shared/contexts/SessionContext', () => ({
  useSession: () => ({
    user: sessionCtl.userId ? {id: sessionCtl.userId} : null,
    session: null,
    loading: false,
    enabled: false,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

function wrapper({children}: {children: ReactNode}) {
  return <DeckProvider>{children}</DeckProvider>;
}

const render = () => renderHook(() => useDeck(), {wrapper});

beforeEach(() => {
  localStorage.clear();
  fixtureCards.clear();
  mockCtl.loading = false;
  sessionCtl.userId = null;
  fixtureCards.set('amber', createCard({id: 'amber', fullName: 'Amber Card', ink: 'Amber'}));
  fixtureCards.set('steel', createCard({id: 'steel', fullName: 'Steel Card', ink: 'Steel'}));
  // Dual-ink is two typed fields (ink + ink2), not a hyphenated string — that's what getInks reads.
  fixtureCards.set(
    'dual',
    createCard({id: 'dual', fullName: 'Dual Card', ink: 'Amethyst', ink2: 'Sapphire'}),
  );
});

// Both persistence tests share one fake-timer arrange (render, add a card) and one
// assert (the add reached the stored draft). They differ only in what triggers the
// write, so each test passes in just that trigger.
function expectAddPersistsVia(trigger: (rendered: ReturnType<typeof render>) => void) {
  vi.useFakeTimers();
  try {
    const rendered = render();
    act(() => rendered.result.current.addCard('amber'));
    act(() => trigger(rendered));
    expect(readDraft()?.cards).toEqual([{cardId: 'amber', quantity: 1}]);
  } finally {
    vi.useRealTimers();
  }
}

describe('DeckContext', () => {
  it('addCard creates a line then increments the existing line', () => {
    const {result} = render();
    act(() => result.current.addCard('amber'));
    act(() => result.current.addCard('amber'));
    expect(result.current.deck.cards).toEqual([{cardId: 'amber', quantity: 2}]);
  });

  it('setQuantity sets an exact count and removes the line at 0', () => {
    const {result} = render();
    act(() => result.current.setQuantity('amber', 3));
    expect(result.current.deck.cards).toEqual([{cardId: 'amber', quantity: 3}]);
    act(() => result.current.setQuantity('amber', 0));
    expect(result.current.deck.cards).toEqual([]);
  });

  it('removeCard drops the line', () => {
    const {result} = render();
    act(() => result.current.addCard('amber'));
    act(() => result.current.removeCard('amber'));
    expect(result.current.deck.cards).toEqual([]);
  });

  it('markCore toggles the isCore flag on a line', () => {
    const {result} = render();
    act(() => result.current.addCard('amber'));
    act(() => result.current.markCore('amber', true));
    expect(result.current.deck.cards[0].isCore).toBe(true);
  });

  it('setGameplan and renameDeck update deck metadata', () => {
    const {result} = render();
    act(() => result.current.setGameplan('ramp'));
    act(() => result.current.renameDeck('Ramp Pile'));
    expect(result.current.deck.gameplan).toBe('ramp');
    expect(result.current.deck.name).toBe('Ramp Pile');
  });

  it('clearDeck empties cards but keeps the deck id and name', () => {
    const {result} = render();
    const id = result.current.deck.id;
    act(() => result.current.renameDeck('Keep Me'));
    act(() => result.current.addCard('amber'));
    act(() => result.current.clearDeck());
    expect(result.current.deck.cards).toEqual([]);
    expect(result.current.deck.id).toBe(id);
    expect(result.current.deck.name).toBe('Keep Me');
  });

  it('derives inks in canonical order, dual-ink counting both', () => {
    const {result} = render();
    act(() => result.current.addCard('dual')); // Amethyst + Sapphire
    act(() => result.current.addCard('amber')); // Amber
    expect(result.current.deck.inks).toEqual(['Amber', 'Amethyst', 'Sapphire']);
  });

  it('persists the draft to localStorage after the debounce window', () => {
    // 500ms clears the 400ms debounce, so the scheduled write fires.
    expectAddPersistsVia(() => vi.advanceTimersByTime(500));
  });

  it('restores a persisted draft on mount', () => {
    const stored: Deck = {
      id: 'saved-1',
      name: 'Saved Deck',
      cards: [{cardId: 'amber', quantity: 3}],
      inks: ['Amber'],
      createdAt: 1,
      updatedAt: 2,
      schemaVersion: 1,
    };
    writeDraft(stored);
    const {result} = render();
    expect(result.current.deck.id).toBe('saved-1');
    expect(result.current.deck.name).toBe('Saved Deck');
    expect(result.current.deck.cards).toEqual([{cardId: 'amber', quantity: 3}]);
  });

  it('flushes the draft on unmount even inside the debounce window', () => {
    // Unmount BEFORE the 400ms debounce fires; the flush-on-unmount path still writes.
    expectAddPersistsVia(({unmount}) => unmount());
  });

  it('self-heals stale stored inks against the card DB on mount', () => {
    // Stored inks are wrong for the actual cards; the self-heal effect corrects them.
    const stale: Deck = {
      id: 'stale-1',
      name: 'Stale',
      cards: [{cardId: 'dual', quantity: 1}],
      inks: ['Amber'],
      createdAt: 1,
      updatedAt: 2,
      schemaVersion: 1,
    };
    writeDraft(stale);
    const {result} = render();
    expect(result.current.deck.inks).toEqual(['Amethyst', 'Sapphire']);
  });

  it('does not wipe stored inks while the card DB is still loading', () => {
    mockCtl.loading = true; // getCardById -> undefined for everything
    const loading: Deck = {
      id: 'loading-1',
      name: 'Loading',
      cards: [{cardId: 'amber', quantity: 1}],
      inks: ['Amber'],
      createdAt: 1,
      updatedAt: 2,
      schemaVersion: 1,
    };
    writeDraft(loading);
    const {result} = render();
    expect(result.current.deck.inks).toEqual(['Amber']);
  });

  it('starts clean, goes dirty on an edit, and is clean again after markSaved', () => {
    const {result} = render();
    expect(result.current.isDirty).toBe(false);
    act(() => result.current.addCard('amber'));
    expect(result.current.isDirty).toBe(true);
    act(() => result.current.markSaved({...result.current.deck, ownerId: 'u1'}));
    expect(result.current.isDirty).toBe(false);
    expect(result.current.deck.ownerId).toBe('u1');
  });

  it('startNewDeck empties the deck, unbinds it, and records the visibility', () => {
    const {result} = render();
    act(() => result.current.addCard('amber'));
    const previousId = result.current.deck.id;
    act(() => result.current.startNewDeck('public'));
    expect(result.current.deck.cards).toHaveLength(0);
    expect(result.current.deck.id).not.toBe(previousId);
    expect(result.current.deck.ownerId).toBeNull();
    expect(result.current.deck.isPublic).toBe(true);
    expect(result.current.isDirty).toBe(false);
  });

  it('loadDeck replaces the draft and marks it clean', () => {
    const {result} = render();
    act(() => result.current.addCard('amber'));
    const saved = {...result.current.deck, id: 'cloud-1', name: 'Saved', cards: [], ownerId: 'u1'};
    act(() => result.current.loadDeck(saved));
    expect(result.current.deck.id).toBe('cloud-1');
    expect(result.current.deck.name).toBe('Saved');
    expect(result.current.isDirty).toBe(false);
  });

  it('clears the draft when a signed-in user signs out', () => {
    sessionCtl.userId = 'u1';
    const {result, rerender} = render();
    act(() => result.current.addCard('amber'));
    sessionCtl.userId = null;
    rerender();
    expect(readDraft()).toBeNull();
  });

  // The clear above is worthless on its own: the deck is still in React state, and
  // BOTH writers would put it straight back, handing it to the next person on a
  // shared browser. Teardown fires on unmount and on pagehide (tab close).
  it('does not resurrect the departed deck on unmount', () => {
    sessionCtl.userId = 'u1';
    const {result, rerender, unmount} = render();
    act(() => result.current.addCard('amber'));
    sessionCtl.userId = null;
    rerender();

    unmount();

    expect(readDraft()).toBeNull();
  });

  it('does not resurrect the departed deck on pagehide', () => {
    sessionCtl.userId = 'u1';
    const {result, rerender} = render();
    act(() => result.current.addCard('amber'));
    sessionCtl.userId = null;
    rerender();

    act(() => {
      window.dispatchEvent(new Event('pagehide'));
    });

    expect(readDraft()).toBeNull();
  });
});

afterEach(() => vi.clearAllMocks());
