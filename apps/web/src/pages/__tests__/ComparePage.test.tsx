import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Routes, Route} from 'react-router-dom';
import type {LorcanaCard} from '../../features/cards';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';

const mockOpenComparison = vi.fn();
const mockGetCardById = vi.fn<(id: string) => LorcanaCard | undefined>();
const mockCardsLoading = vi.fn(() => false);
const mockGetPairSynergies = vi.fn<
  (clickedCard: LorcanaCard, groupKey?: string) => DetailedPairSynergy | null
>();
const mockSynergiesLoading = vi.fn(() => false);

vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({getCardById: mockGetCardById, isLoading: mockCardsLoading()}),
}));

vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({openComparison: mockOpenComparison}),
}));

vi.mock('../../features/synergies/hooks', () => ({
  usePrecomputedSynergies: () => ({
    getPairSynergies: mockGetPairSynergies,
    isLoading: mockSynergiesLoading(),
    synergies: [],
    error: null,
  }),
}));

vi.mock('../NotFoundPage', () => ({
  NotFoundPage: () => <div data-testid="not-found">Not found</div>,
}));

import {ComparePage} from '../ComparePage';

function renderAt(initialPath: string) {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/compare/:idA/:idB" element={<ComparePage />} />
        <Route path="/compare/:idA/:idB/:groupKey" element={<ComparePage />} />
        <Route path="/card/:cardId" element={<div data-testid="redirected-to-card" />} />
      </Routes>
    </MemoryRouter>,
  );
}

const cardA = {id: 'a1', name: 'Card A'} as unknown as LorcanaCard;
const cardB = {id: 'b1', name: 'Card B'} as unknown as LorcanaCard;

function pairWithConnections(): DetailedPairSynergy {
  return {
    cardA,
    cardB,
    connections: [
      {
        ruleId: 'shift-targets',
        ruleName: 'Shift Targets',
        category: 'direct',
        score: 8,
        explanation: 'Stub',
      },
    ],
    aggregateScore: 8,
  };
}

function emptyPair(): DetailedPairSynergy {
  return {cardA, cardB, connections: [], aggregateScore: 0};
}

describe('ComparePage', () => {
  beforeEach(() => {
    mockOpenComparison.mockReset();
    mockGetCardById.mockReset();
    mockGetPairSynergies.mockReset();
    mockCardsLoading.mockReturnValue(false);
    mockSynergiesLoading.mockReturnValue(false);
  });

  it('opens the modal when IDs, group key, and a connection-bearing pair all resolve', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : id === 'b1' ? cardB : undefined));
    mockGetPairSynergies.mockReturnValue(pairWithConnections());
    renderAt('/compare/a1/b1/shift-targets');
    expect(mockOpenComparison).toHaveBeenCalledWith('a1', 'b1', 'shift-targets');
  });

  it('renders NotFoundPage for the unfiltered URL (no group key)', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : id === 'b1' ? cardB : undefined));
    renderAt('/compare/a1/b1');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('renders NotFoundPage when the group key has no connections for the pair', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : id === 'b1' ? cardB : undefined));
    mockGetPairSynergies.mockReturnValue(emptyPair());
    renderAt('/compare/a1/b1/non-existent-group');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('renders NotFoundPage when getPairSynergies returns null', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : id === 'b1' ? cardB : undefined));
    mockGetPairSynergies.mockReturnValue(null);
    renderAt('/compare/a1/b1/shift-targets');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('redirects to /card/:id when both IDs are the same', () => {
    mockGetCardById.mockReturnValue(cardA);
    renderAt('/compare/a1/a1/shift-targets');
    expect(screen.getByTestId('redirected-to-card')).toBeInTheDocument();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('renders NotFoundPage when one of the IDs does not match a card', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : undefined));
    renderAt('/compare/a1/missing/shift-targets');
    expect(screen.getByTestId('not-found')).toBeInTheDocument();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('waits for card data to load before deciding the cards are missing', () => {
    mockCardsLoading.mockReturnValue(true);
    mockGetCardById.mockReturnValue(undefined);
    renderAt('/compare/a1/b1/shift-targets');
    expect(screen.queryByTestId('not-found')).toBeNull();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });

  it('waits for synergies to load before deciding the pair has no connections', () => {
    mockGetCardById.mockImplementation((id) => (id === 'a1' ? cardA : id === 'b1' ? cardB : undefined));
    mockSynergiesLoading.mockReturnValue(true);
    mockGetPairSynergies.mockReturnValue(null);
    renderAt('/compare/a1/b1/shift-targets');
    expect(screen.queryByTestId('not-found')).toBeNull();
    expect(mockOpenComparison).not.toHaveBeenCalled();
  });
});
