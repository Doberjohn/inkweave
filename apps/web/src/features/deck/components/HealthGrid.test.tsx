import {describe, expect, it} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {DeckStatus, HealthAnalyzer, ScoreContribution} from '../types';
import {HealthGrid} from './HealthGrid';

const analyzer = (id: string, label: string, score: number, status: DeckStatus, message = `${label} verdict`): HealthAnalyzer => ({
  id,
  label,
  score,
  status,
  message,
});

const contribution = (dimension: string, points: number): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution: points,
  reason: 'r',
});

const SET: HealthAnalyzer[] = [
  analyzer('curve', 'Curve', 90, 'good'),
  analyzer('removal', 'Removal', 40, 'bad'),
  analyzer('draw', 'Card Draw', 55, 'warn'),
  analyzer('typeMix', 'Card Types', 75, 'good'),
];

const BREAKDOWN: ScoreContribution[] = [contribution('removal', 6), contribution('draw', 7)];

describe('HealthGrid', () => {
  it('renders a ring per analyzer, worst statuses first, build order breaking ties', () => {
    render(<HealthGrid analyzers={SET} breakdown={BREAKDOWN} />);
    const rings = screen.getAllByRole('img').map((el) => el.getAttribute('aria-label'));
    expect(rings).toEqual([
      'Removal score 40 of 100', // bad leads
      'Draw score 55 of 100', // warn next
      'Curve score 90 of 100', // good, built first
      'Card Types score 75 of 100', // good, built later (score does not jump the queue)
    ]);
  });

  it('keeps Card Draw and Card Types distinguishable in the grid captions', () => {
    render(<HealthGrid analyzers={SET} breakdown={BREAKDOWN} />);
    expect(screen.getByText('Draw')).toBeInTheDocument();
    expect(screen.getByText('Card Types')).toBeInTheDocument();
  });

  it('defaults the detail slot to the worst dimension, with its points', () => {
    render(<HealthGrid analyzers={SET} breakdown={BREAKDOWN} />);
    expect(screen.getByText(/Removal · 40/)).toBeInTheDocument();
    expect(screen.getByText('+6 points')).toBeInTheDocument();
    expect(screen.getByText('Removal verdict')).toBeInTheDocument();
  });

  it('selecting another ring swaps the detail slot to its full label and verdict', () => {
    render(<HealthGrid analyzers={SET} breakdown={BREAKDOWN} />);
    fireEvent.click(screen.getByRole('button', {name: /Draw score 55/}));
    expect(screen.getByText(/Card Draw · 55/)).toBeInTheDocument();
    expect(screen.getByText('Card Draw verdict')).toBeInTheDocument();
  });

  it('omits the points chip when a dimension has no breakdown entry', () => {
    render(<HealthGrid analyzers={SET} breakdown={BREAKDOWN} />);
    fireEvent.click(screen.getByRole('button', {name: /Curve score 90/}));
    expect(screen.getByText(/Curve · 90/)).toBeInTheDocument();
    expect(screen.queryByText(/points/)).not.toBeInTheDocument();
  });

  it('renders nothing for an empty analyzer set', () => {
    const {container} = render(<HealthGrid analyzers={[]} breakdown={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
