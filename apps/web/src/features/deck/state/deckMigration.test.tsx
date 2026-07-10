import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, act} from '@testing-library/react';
import type {ReactNode} from 'react';
import {DeckProvider} from './DeckContext';
import {writeDraft} from './deckStorage';
import {createCard} from '../../../shared/test-utils';
import type {Deck, LorcanaCard} from '../types';

// Fixture card DB (resolved so inks derive), a mutable session, and a spied cloud
// upsert. The migrator (#464) lives in DeckProvider and reacts to the session uid.
const fixtureCards = vi.hoisted(() => new Map<string, LorcanaCard>());
vi.mock('../../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: (id: string) => fixtureCards.get(id), isLoading: false}),
}));

const sessionCtl = vi.hoisted(() => ({uid: null as string | null}));
vi.mock('../../../shared/contexts/SessionContext', () => ({
  useSession: () => ({
    user: sessionCtl.uid ? {id: sessionCtl.uid} : null,
    session: null,
    loading: false,
    enabled: true,
    signIn: vi.fn(),
    signOut: vi.fn(),
  }),
}));

const upsertDeck = vi.hoisted(() => vi.fn(() => Promise.resolve({data: null, error: null})));
vi.mock('./deckRepository', () => ({upsertDeck}));

function seedDraft() {
  const draft: Deck = {
    id: 'draft-1',
    name: 'Draft',
    cards: [{cardId: 'amber', quantity: 2}],
    inks: ['Amber'],
    createdAt: 1,
    updatedAt: 1,
    schemaVersion: 1,
  };
  writeDraft(draft);
}

beforeEach(() => {
  localStorage.clear();
  fixtureCards.clear();
  fixtureCards.set('amber', createCard({id: 'amber', ink: 'Amber'}));
  sessionCtl.uid = null;
  upsertDeck.mockClear();
  seedDraft();
});

const wrapper = ({children}: {children: ReactNode}) => <DeckProvider>{children}</DeckProvider>;

describe('first-sign-in draft migration (#464)', () => {
  it('migrates the pre-sign-in draft once when a user signs in', () => {
    sessionCtl.uid = 'userA';
    render(<div />, {wrapper});
    expect(upsertDeck).toHaveBeenCalledTimes(1);
    expect(upsertDeck).toHaveBeenCalledWith(expect.objectContaining({ownerId: 'userA'}), 'userA');
  });

  it('does NOT migrate a signed-in user with an empty pre-sign-in draft', () => {
    localStorage.clear(); // no draft
    sessionCtl.uid = 'userA';
    render(<div />, {wrapper});
    expect(upsertDeck).not.toHaveBeenCalled();
  });

  it('does NOT migrate the prior user draft into a second account after sign-out (shared browser)', () => {
    sessionCtl.uid = 'userA';
    const {rerender} = render(<div />, {wrapper});
    expect(upsertDeck).toHaveBeenCalledTimes(1); // A's draft migrated
    upsertDeck.mockClear();
    // A signs out, then B signs in on the SAME page instance (no reload).
    act(() => {
      sessionCtl.uid = null;
      rerender(<div />);
    });
    act(() => {
      sessionCtl.uid = 'userB';
      rerender(<div />);
    });
    expect(upsertDeck).not.toHaveBeenCalled(); // B must not inherit A's leftover draft
  });
});
