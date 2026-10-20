import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter, Route, Routes} from 'react-router-dom';
import type {LorcanaCard} from 'inkweave-synergy-engine';
import type {VotingPair} from '../../features/voting/types';

const mockPairState = vi.fn<() => {pair: VotingPair | null; isLoading: boolean; error: string | null}>();

vi.mock('../../features/voting/hooks/useSpecificPair', () => ({
  useSpecificPair: () => mockPairState(),
}));
vi.mock('../../shared/contexts/CardDataContext', () => ({
  useCardDataContext: () => ({cards: []}),
}));
vi.mock('../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({openCardModal: vi.fn()}),
}));
vi.mock('../../shared/hooks', async () => {
  const actual = await vi.importActual('../../shared/hooks');
  return {...actual, useResponsive: () => ({isMobile: false})};
});
// The page's own markup is under test; the header, the cards and the form are stubbed.
vi.mock('../../shared/components', async () => {
  const actual = await vi.importActual('../../shared/components');
  return {...actual, CompactHeader: () => null, EtherealBackground: () => null};
});
vi.mock('../../features/voting', () => ({
  PairDisplay: () => <div data-testid="pair-display" />,
  VoteStatusBanner: () => null,
  InDepthVoteForm: () => <div data-testid="vote-form" />,
  VoteFormSkeleton: () => <div />,
}));

import {InDepthVotePage} from '../InDepthVotePage';

const cardA = {id: 'a1', name: 'Woody', fullName: 'Woody - Jungle Guide'} as unknown as LorcanaCard;
const cardB = {id: 'b1', name: 'Woody', fullName: 'Woody - Waiting for a Friend'} as unknown as LorcanaCard;
const pair = {cardA, cardB, aggregateScore: 8, connections: []} as unknown as VotingPair;

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/vote/a1/b1']}>
      <Routes>
        <Route path="/vote/:cardAId/:cardBId" element={<InDepthVotePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('InDepthVotePage', () => {
  beforeEach(() => mockPairState.mockReset());

  it('names the pair in the tab and in its one, visually hidden, h1', () => {
    mockPairState.mockReturnValue({pair, isLoading: false, error: null});
    renderPage();
    expect(document.title).toBe('Woody - Jungle Guide + Woody - Waiting for a Friend | Vote | Inkweave');
    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
    expect(
      screen.getByRole('heading', {level: 1, name: 'Vote on Woody - Jungle Guide and Woody - Waiting for a Friend'}),
    ).toBeInTheDocument();
  });

  it('titles and heads the page while the pair loads', () => {
    mockPairState.mockReturnValue({pair: null, isLoading: true, error: null});
    renderPage();
    expect(document.title).toBe('Vote on a card pair | Inkweave');
    expect(screen.getAllByRole('heading', {level: 1})).toHaveLength(1);
    expect(screen.getByRole('heading', {level: 1, name: 'Vote on a card pair'})).toBeInTheDocument();
  });

  it('titles the tab and heads the main with the error when the pair fails to load', () => {
    mockPairState.mockReturnValue({pair: null, isLoading: false, error: 'One or both cards not found'});
    renderPage();
    expect(document.title).toBe('One or both cards not found | Inkweave');
    expect(screen.getByRole('main')).toContainElement(
      screen.getByRole('heading', {level: 1, name: 'One or both cards not found'}),
    );
  });
});
