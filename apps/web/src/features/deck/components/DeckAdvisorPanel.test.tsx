import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckAnalysis} from '../analysis/analyzeDeck';
import type {DeckStatus, HealthAnalyzer, Vulnerability} from '../types';
import {DeckAdvisorPanel} from './DeckAdvisorPanel';

const analyzer = (id: string, label: string, score: number, status: DeckStatus): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message: '',
});

const vuln = (id: string): Vulnerability => ({id, label: id, conditionType: id, severity: 'high', message: ''});

const ANALYSIS: DeckAnalysis = {
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
  health: {
    overall: 72,
    archetype: 'midrange',
    archetypeConfidence: 0.8,
    analyzers: [analyzer('curve', 'Curve', 90, 'good'), analyzer('removal', 'Removal', 40, 'bad')],
    vulnerabilities: [vuln('low-strength')],
  },
  quality: {score: 72, breakdown: [], configVersion: '1'},
};

const noop = () => {};

describe('DeckAdvisorPanel', () => {
  it('prompts to add cards when there is no analysis', () => {
    render(<DeckAdvisorPanel analysis={null} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.getByText(/add cards to see/i)).toBeInTheDocument();
  });

  it('shows the loading state while the first analysis runs', () => {
    render(<DeckAdvisorPanel analysis={null} isLoading error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.getByText(/analyzing deck/i)).toBeInTheDocument();
  });

  it('surfaces an unavailable state on error', () => {
    render(
      <DeckAdvisorPanel analysis={null} isLoading={false} error={new Error('boom')} gameplan={undefined} onGameplanChange={noop} />,
    );
    expect(screen.getByText(/analysis unavailable/i)).toBeInTheDocument();
  });

  it('composes badge, score, health list, and vulnerabilities when analysis exists', () => {
    render(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.getByText('Midrange')).toBeInTheDocument();
    expect(screen.getByText(/deck quality score/i)).toBeInTheDocument();
    expect(screen.getByText(/health by dimension/i)).toBeInTheDocument();
    expect(screen.getByText('low-strength')).toBeInTheDocument();
  });

  it('declaring a gameplan reports the archetype to onGameplanChange', () => {
    const onChange = vi.fn();
    render(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan={undefined} onGameplanChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', {name: 'Declared gameplan'}), {target: {value: 'ramp'}});
    expect(onChange).toHaveBeenCalledWith('ramp');
  });

  it('choosing Auto-detect clears the declaration with undefined', () => {
    const onChange = vi.fn();
    render(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan="ramp" onGameplanChange={onChange} />);
    fireEvent.change(screen.getByRole('combobox', {name: 'Declared gameplan'}), {target: {value: 'auto'}});
    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('marks the badge as declared when a gameplan is set', () => {
    render(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan="midrange" onGameplanChange={noop} />);
    expect(screen.getByText('Declared gameplan')).toBeInTheDocument();
  });

  // Adversarial-review find: mathOpen must not outlive the analysis. Clearing the
  // deck while the modal is open, then re-adding cards, must NOT re-open it.
  it('does not resurrect the math modal after analysis empties and returns', () => {
    const {rerender} = render(
      <DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />,
    );
    fireEvent.click(screen.getByRole('button', {name: /show the math/i}));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    rerender(<DeckAdvisorPanel analysis={null} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    rerender(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens the score-math modal from the gauge and closes it again', () => {
    render(<DeckAdvisorPanel analysis={ANALYSIS} isLoading={false} error={null} gameplan={undefined} onGameplanChange={noop} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /show the math/i}));
    expect(screen.getByRole('dialog', {name: /score math for 72/i})).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
