import {describe, it, expect, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {PairDisplay} from '../PairDisplay';
import {createCard, createVotingPair, createConnection} from '../../../../shared/test-utils';
import type {Score} from '../../../../shared/lib/supabase';
import type {PairPreview} from '../../hooks/usePairQueue';

vi.mock('../../../synergies/utils/scoreUtils', () => ({
  getStrengthTier: (score: number) => ({
    label: score >= 9.5 ? 'Perfect' : score >= 7 ? 'Strong' : score >= 4 ? 'Moderate' : 'Weak',
    color: '#fbbf24',
    bg: '#3d3010',
  }),
}));

vi.mock('../VotingCardDisplay', () => ({
  VotingCardDisplay: ({card, isMobile, highlighted}: {card: {fullName: string}; isMobile?: boolean; highlighted?: boolean}) => (
    <div data-testid="voting-card" data-card-name={card.fullName} data-mobile={isMobile} data-highlighted={highlighted} />
  ),
}));

vi.mock('../PairStack', () => ({
  PairStack: ({pairs, side}: {pairs: unknown[]; side: string}) => <div data-testid="pair-stack" data-side={side} data-count={pairs.length} />,
}));

vi.mock('../../../../shared/components', () => ({
  ConnectionGroup: ({group}: {group: {label: string; connections: {explanation: string}[]}}) => (
    <div data-testid="connection-group">
      <span>{group.label}</span>
      {group.connections.map((c: {explanation: string}, i: number) => <span key={i}>{c.explanation}</span>)}
    </div>
  ),
  groupConnections: (conns: unknown[]) => conns.map((c: Record<string, unknown>) => ({key: c.ruleId, label: c.ruleName, score: c.score, connections: [c], category: c.category})),
}));

const pair = createVotingPair({
  cardA: {id: 'elsa-1', fullName: 'Elsa - Ice Queen'},
  cardB: {id: 'anna-1', fullName: 'Anna - Brave Princess'},
  connections: [
    createConnection({
      ruleName: 'Shift Targets',
      explanation: 'Elsa - Ice Queen and Anna - Brave Princess share a Shift synergy',
    }),
  ],
});

describe('PairDisplay', () => {
  it('renders two VotingCardDisplay components', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    const cards = screen.getAllByTestId('voting-card');
    expect(cards).toHaveLength(2);
    expect(cards[0].getAttribute('data-card-name')).toBe('Elsa - Ice Queen');
    expect(cards[1].getAttribute('data-card-name')).toBe('Anna - Brave Princess');
  });

  it('desktop: renders dashed lines', () => {
    const {container} = render(<PairDisplay pair={pair} selectedScore={null} />);
    const svgs = container.querySelectorAll('svg');
    expect(svgs.length).toBeGreaterThanOrEqual(2);
    const dashedLines = container.querySelectorAll('line[stroke-dasharray]');
    expect(dashedLines.length).toBeGreaterThanOrEqual(2);
  });

  it('shows mystery badge with "?" when no score selected', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    expect(screen.getByText('?')).toBeTruthy();
  });

  it('shows score in mystery badge when selectedScore provided', () => {
    render(<PairDisplay pair={pair} selectedScore={8 as Score} />);
    expect(screen.getByText('8')).toBeTruthy();
    expect(screen.queryByText('?')).toBeNull();
  });

  it('renders synergy description with connection rule name', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    expect(screen.getByText('Shift Targets')).toBeTruthy();
  });

  it('renders explanation text in synergy description', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    // The explanation text is split into segments by ExplanationWithHighlights,
    // so we check for a substring that won't be a card name segment
    expect(screen.getByText(/share a Shift synergy/)).toBeTruthy();
  });

  it('mobile: renders mobile layout', () => {
    render(<PairDisplay pair={pair} selectedScore={null} isMobile />);
    const cards = screen.getAllByTestId('voting-card');
    expect(cards[0].getAttribute('data-mobile')).toBe('true');
    expect(cards[1].getAttribute('data-mobile')).toBe('true');
  });

  it('desktop: renders desktop layout', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    const cards = screen.getAllByTestId('voting-card');
    // Desktop: isMobile is undefined, so data-mobile should not be "true"
    expect(cards[0].getAttribute('data-mobile')).not.toBe('true');
  });

  it('does not render previous stack when previousPairs is undefined', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    const stacks = screen.queryAllByTestId('pair-stack');
    const leftStacks = stacks.filter((s) => s.getAttribute('data-side') === 'left');
    expect(leftStacks).toHaveLength(0);
  });

  it('does not render upcoming stack when upcomingPairs is undefined', () => {
    render(<PairDisplay pair={pair} selectedScore={null} />);
    const stacks = screen.queryAllByTestId('pair-stack');
    const rightStacks = stacks.filter((s) => s.getAttribute('data-side') === 'right');
    expect(rightStacks).toHaveLength(0);
  });

  it('renders previous stack when previousPairs provided', () => {
    const previousPairs: PairPreview[] = [
      {
        cardA: createCard({id: 'prev-a', fullName: 'Prev A'}),
        cardB: createCard({id: 'prev-b', fullName: 'Prev B'}),
      },
    ];
    render(<PairDisplay pair={pair} selectedScore={null} previousPairs={previousPairs} />);
    const stacks = screen.queryAllByTestId('pair-stack');
    const leftStacks = stacks.filter((s) => s.getAttribute('data-side') === 'left');
    expect(leftStacks).toHaveLength(1);
    expect(leftStacks[0].getAttribute('data-count')).toBe('1');
  });

  it('renders upcoming stack when upcomingPairs provided', () => {
    const upcomingPairs: PairPreview[] = [
      {
        cardA: createCard({id: 'up-a', fullName: 'Upcoming A'}),
        cardB: createCard({id: 'up-b', fullName: 'Upcoming B'}),
      },
    ];
    render(<PairDisplay pair={pair} selectedScore={null} upcomingPairs={upcomingPairs} />);
    const stacks = screen.queryAllByTestId('pair-stack');
    const rightStacks = stacks.filter((s) => s.getAttribute('data-side') === 'right');
    expect(rightStacks).toHaveLength(1);
    expect(rightStacks[0].getAttribute('data-count')).toBe('1');
  });
});
