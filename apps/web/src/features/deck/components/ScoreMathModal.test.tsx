import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckStatus, HealthAnalyzer, ScoreContribution} from '../types';
import {ScoreMathModal} from './ScoreMathModal';

const analyzer = (id: string, label: string, score: number, status: DeckStatus): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message: `${label} verdict`,
});

const contribution = (dimension: string, points: number, reason = `${dimension} reason`): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
  reason,
});

const ANALYZERS: HealthAnalyzer[] = [
  analyzer('curve', 'Curve', 90, 'good'),
  analyzer('removal', 'Removal', 40, 'bad'),
  analyzer('draw', 'Card Draw', 55, 'warn'),
];

// Mirrors score.ts: each dimension's reason IS the analyzer message verbatim
// (only the penalty carries distinct prose).
const BREAKDOWN: ScoreContribution[] = [
  contribution('curve', 14, 'Curve verdict'),
  contribution('removal', 6, 'Removal verdict'),
  contribution('draw', 7, 'Card Draw verdict'),
  contribution('vulnerability-penalty', -6, '2 vulnerabilities subtract 6 points'),
];

const renderModal = (onClose = vi.fn()) => {
  render(<ScoreMathModal score={72} configVersion="1" analyzers={ANALYZERS} breakdown={BREAKDOWN} onClose={onClose} />);
  return onClose;
};

describe('ScoreMathModal', () => {
  it('renders a dialog with one row per dimension, full labels, scores, and signed points', () => {
    renderModal();
    expect(screen.getByRole('dialog', {name: /score math for 72/i})).toBeInTheDocument();
    expect(screen.getByText('Curve')).toBeInTheDocument();
    expect(screen.getByText('Card Draw')).toBeInTheDocument();
    expect(screen.getByText('+14')).toBeInTheDocument();
    expect(screen.getByText('+7')).toBeInTheDocument();
  });

  it('pre-expands bad rows so problems self-explain', () => {
    renderModal();
    // getByText throws on multiple matches, so this also pins the verdict
    // appearing ONCE even though score.ts duplicates it into `reason`.
    expect(screen.getByText(/Removal verdict/)).toBeInTheDocument();
    expect(screen.queryByText(/Curve verdict/)).not.toBeInTheDocument();
  });

  it('computes the weight line from the structured fields, not the duplicated reason', () => {
    renderModal();
    expect(screen.getByText(/Weight 0.1, hitting 50% of target/)).toBeInTheDocument();
  });

  it('toggles another row open without closing the pre-expanded one', () => {
    renderModal();
    fireEvent.click(screen.getByRole('button', {name: /Card Draw/}));
    expect(screen.getByText(/Card Draw verdict/)).toBeInTheDocument();
    expect(screen.getByText(/Removal verdict/)).toBeInTheDocument();
  });

  it('shows the vulnerability penalty last with its reason always visible', () => {
    renderModal();
    expect(screen.getByText('Vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText('-6')).toBeInTheDocument();
    expect(screen.getByText(/subtract 6 points/)).toBeInTheDocument();
  });

  it('renders breakdown terms with no matching analyzer instead of dropping them', () => {
    render(
      <ScoreMathModal
        score={72}
        configVersion="1"
        analyzers={ANALYZERS}
        breakdown={[...BREAKDOWN, contribution('archetypeCoherence', 3)]}
        onClose={vi.fn()}
      />,
    );
    expect(screen.getByText('Archetype Coherence')).toBeInTheDocument();
    expect(screen.getByText('+3')).toBeInTheDocument();
  });

  it('closes on Escape and via the Close button', () => {
    const onClose = renderModal();
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', {name: 'Close'}));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
