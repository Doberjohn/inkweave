import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus, HealthAnalyzer, Vulnerability} from '../types';
import {HealthSummary} from './HealthSummary';

const analyzer = (id: string, label: string, score: number, status: DeckStatus): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message: '',
  value: score,
});

const vuln = (id: string): Vulnerability => ({id, label: id, conditionType: id, severity: 'high', message: ''});

const analysis = (score: number, analyzers: HealthAnalyzer[], vulnerabilities: Vulnerability[]): DeckAnalysis => ({
  stats: {
    totalCards: 60,
    uniqueCards: 17,
    inkDistribution: {},
    costCurve: {},
    costCurveByInk: {},
    typeDistribution: {},
    inkCount: 2,
    inkableCount: 46,
    isLegal: true,
    legalityErrors: [],
  },
  synergy: {overallScore: 74, keyCards: [], weakLinks: [], connectionCounts: {}},
  health: {overall: score, archetype: 'midrange', archetypeConfidence: 0.8, analyzers, vulnerabilities},
  quality: {score, breakdown: [], configVersion: '1'},
});

describe('HealthSummary', () => {
  it('shows the score, tier, the worst flags (bad before warn), and the risk count', () => {
    render(
      <HealthSummary
        isLoading={false}
        onOpenAnalysis={vi.fn()}
        analysis={analysis(
          72,
          [analyzer('curve', 'Curve', 90, 'good'), analyzer('removal', 'Removal', 55, 'warn'), analyzer('draw', 'Card Draw', 40, 'bad')],
          [vuln('a'), vuln('b')],
        )}
      />,
    );
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Card Draw')).toBeInTheDocument();
    expect(screen.getByText('Removal')).toBeInTheDocument();
    // a good dimension is never surfaced as a flag
    expect(screen.queryByText('Curve')).not.toBeInTheDocument();
    expect(screen.getByText('2 risks')).toBeInTheDocument();
  });

  it('opens the analysis tab on click', () => {
    const onOpenAnalysis = vi.fn();
    render(<HealthSummary isLoading={false} onOpenAnalysis={onOpenAnalysis} analysis={analysis(80, [], [])} />);
    fireEvent.click(screen.getByRole('button', {name: /open deck analysis/i}));
    expect(onOpenAnalysis).toHaveBeenCalledOnce();
  });

  it('shows a loading state before the first analysis lands', () => {
    render(<HealthSummary isLoading onOpenAnalysis={vi.fn()} analysis={null} />);
    expect(screen.getByText(/analyzing/i)).toBeInTheDocument();
  });

  it('shows an unavailable note when the advisor errored', () => {
    render(<HealthSummary isLoading={false} error={new Error('boom')} onOpenAnalysis={vi.fn()} analysis={null} />);
    expect(screen.getByText(/analysis unavailable/i)).toBeInTheDocument();
  });
});
