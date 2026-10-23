import {afterEach, describe, expect, it, vi} from 'vitest';
import {act, render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import type {DetailedPairSynergy} from 'inkweave-synergy-engine';
import {CommunityColumn} from '../CommunityColumn';
import {createCard} from '../../../../shared/test-utils';

const {pairScore} = vi.hoisted(() => ({
  pairScore: {current: {score: null, isLoading: true} as {score: null; isLoading: boolean}},
}));

vi.mock('../../../voting/hooks/usePairScore', () => ({usePairScore: () => pairScore.current}));
vi.mock('../../../voting/lib/voteStorage', () => ({hasInDepthVote: () => false}));
vi.mock('../../../../shared/contexts/CardModalContext', () => ({
  useCardModal: () => ({closeCardModal: vi.fn()}),
}));

const PAIR = {
  cardA: createCard({id: '13001'}),
  cardB: createCard({id: '13002'}),
} as unknown as DetailedPairSynergy;

function renderColumn({isLoading, compact = false}: {isLoading: boolean; compact?: boolean}) {
  // A pair with no row is a null score, loaded or not: the column tells them apart by isLoading.
  pairScore.current = {score: null, isLoading};
  render(
    <MemoryRouter>
      <CommunityColumn pair={PAIR} engineScore={6} compact={compact} />
    </MemoryRouter>,
  );
}

// #913: a null score read as 0 votes, in the header and, for 200 ms, the empty state.
describe('CommunityColumn while the pair score loads', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([false, true])('states no vote count and no empty state (compact: %s)', (compact) => {
    renderColumn({isLoading: true, compact});
    expect(screen.queryByText(/\d+ \/ \d+ (in-depth )?votes/)).toBeNull();
    expect(screen.queryByText(/^Not enough/)).toBeNull();
  });

  it('holds the skeleton hidden for 200 ms, then shows it', () => {
    vi.useFakeTimers();
    renderColumn({isLoading: true});
    expect(screen.getByTestId('community-loading')).not.toBeVisible();
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.getByTestId('community-loading')).toBeVisible();
  });

  it('shows the count and the empty state once a pair with no votes has loaded', () => {
    renderColumn({isLoading: false});
    expect(screen.getByText('0 / 1 votes')).toBeInTheDocument();
    expect(screen.getByText('Not enough votes yet')).toBeInTheDocument();
    expect(screen.queryByTestId('community-loading')).toBeNull();
  });
});
