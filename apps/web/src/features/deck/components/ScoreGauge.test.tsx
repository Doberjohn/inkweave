import {describe, expect, it} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import type {QualityScore, ScoreContribution} from '../types';
import {ScoreGauge} from './ScoreGauge';

const row = (dimension: string, contribution: number, reason = 'r'): ScoreContribution => ({
  dimension,
  weight: 0.1,
  dimensionScore: 0.5,
  contribution,
  reason,
});

const quality = (score: number, breakdown: ScoreContribution[]): QualityScore => ({
  score,
  breakdown,
  configVersion: '1',
});

// 6 positive dimensions (> TOP_N of 5) + a penalty, so the "show more" toggle appears.
const sixPlusPenalty: ScoreContribution[] = [
  row('curve', 11),
  row('inkable', 9),
  row('synergyDensity', 8),
  row('removal', 6),
  row('draw', 4),
  row('shiftCoverage', 1, 'Some Shift cards lack a base'),
  row('vulnerability-penalty', -6, '2 vulnerabilities subtract 6 points'),
];

describe('ScoreGauge', () => {
  it('shows the score and its tier band', () => {
    render(<ScoreGauge quality={quality(72, sixPlusPenalty)} />);
    expect(screen.getByText('72')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
  });

  it('bands the tier by score', () => {
    const {rerender} = render(<ScoreGauge quality={quality(88, sixPlusPenalty)} />);
    expect(screen.getByText('Excellent')).toBeInTheDocument();
    rerender(<ScoreGauge quality={quality(34, sixPlusPenalty)} />);
    expect(screen.getByText('Needs work')).toBeInTheDocument();
  });

  it('collapses to the top contributors, expanding on demand', () => {
    render(<ScoreGauge quality={quality(72, sixPlusPenalty)} />);
    // 6 positive dimensions, top 5 shown → the weakest (Shift Coverage) is hidden.
    expect(screen.queryByText('Shift Coverage')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /show 1 more/i}));
    expect(screen.getByText('Shift Coverage')).toBeInTheDocument();
  });

  it('always shows the vulnerability penalty row, below the dimensions', () => {
    render(<ScoreGauge quality={quality(72, sixPlusPenalty)} />);
    expect(screen.getByText('Vulnerabilities')).toBeInTheDocument();
    expect(screen.getByText(/subtract 6 points/i)).toBeInTheDocument();
  });
});
