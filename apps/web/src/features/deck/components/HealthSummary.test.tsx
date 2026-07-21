import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus, HealthAnalyzer, ScoreContribution, Vulnerability} from '../types';
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

// Only `weight` is read (the priorities lens ranks by weight x points-lost).
const weightOf = (dimension: string, weight: number): ScoreContribution => ({
  dimension,
  weight,
  dimensionScore: 0,
  contribution: 0,
  reason: '',
});

const analysis = (
  score: number,
  analyzers: HealthAnalyzer[],
  vulnerabilities: Vulnerability[],
  breakdown: ScoreContribution[] = [],
): DeckAnalysis => ({
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
  quality: {score, breakdown, configVersion: '1'},
});

// Drag = weight x (100 - score): removal 15, draw 9, lore 4.5, inkable 1.5, curve 0.3.
// The fixture is built so the two rankings DIVERGE — top-3 by drag is {removal, draw, lore},
// but top-3 by weight alone is {curve, removal, draw}. Curve carries the heaviest weight and
// is still excluded, because at 99 it loses almost nothing. Without that divergence the test
// stays green even if the `(100 - score)` factor is deleted from selectDragDimensions outright.
const ANALYZERS = [
  analyzer('curve', 'Curve', 99, 'good'),
  analyzer('inkable', 'Inkable Ratio', 70, 'warn'),
  analyzer('draw', 'Card Draw', 55, 'warn'),
  analyzer('removal', 'Removal', 40, 'bad'),
  analyzer('lore', 'Lore Pressure', 70, 'warn'),
];
const WEIGHTS = [
  weightOf('curve', 0.3),
  weightOf('inkable', 0.05),
  weightOf('draw', 0.2),
  weightOf('removal', 0.25),
  weightOf('lore', 0.15),
];

describe('HealthSummary', () => {
  it('surfaces the three dimensions dragging the score down the most', () => {
    render(
      <HealthSummary
        isLoading={false}
        onOpenAnalysis={vi.fn()}
        analysis={analysis(72, ANALYZERS, [vuln('a'), vuln('b')], WEIGHTS)}
      />,
    );
    // Ranked by points LOST, not by weight and not by raw score. Lore (weight .15) makes
    // the cut over Curve (weight .30) purely because Curve has almost nothing left to lose.
    expect(screen.getByText('Removal')).toBeInTheDocument();
    expect(screen.getByText('Draw')).toBeInTheDocument();
    expect(screen.getByText('Lore')).toBeInTheDocument();
    expect(screen.queryByText('Curve')).not.toBeInTheDocument();
    expect(screen.queryByText('Inkable')).not.toBeInTheDocument();
  });

  it('shows the overall score ring with the archetype and risk count', () => {
    const {container} = render(
      <HealthSummary
        isLoading={false}
        onOpenAnalysis={vi.fn()}
        analysis={analysis(72, ANALYZERS, [vuln('a'), vuln('b')], WEIGHTS)}
      />,
    );
    // No analyzer scores 72, so this label identifies the overall ring specifically.
    expect(screen.getByLabelText('score 72 of 100')).toBeInTheDocument();
    // Archetype and risk count are each split across nested spans, so assert on the
    // rendered text rather than on element-exact matches.
    expect(container.textContent).toContain('midrange');
    expect(container.textContent).toContain('2 risks');
  });

  it('renders the radar lens instead of the rings when variant is radar', () => {
    render(
      <HealthSummary
        isLoading={false}
        variant="radar"
        onOpenAnalysis={vi.fn()}
        analysis={analysis(72, ANALYZERS, [vuln('a')], WEIGHTS)}
      />,
    );
    // Radar abbreviates its axes ("Ink"), where the ring lenses spell them ("Inkable"),
    // and it draws the score itself rather than through a labelled ScoreRing.
    expect(screen.getByText('Ink')).toBeInTheDocument();
    expect(screen.queryByLabelText('score 72 of 100')).not.toBeInTheDocument();
    // Assert the coin POSITIVELY: without this, a radar that stopped rendering the score
    // would make the negative assertion above more true, not less, and still pass.
    expect(screen.getByText('72')).toBeInTheDocument();
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
