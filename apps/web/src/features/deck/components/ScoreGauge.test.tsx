import {describe, expect, it, vi} from 'vitest';
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

// 6 positive dimensions + a penalty, all behind the "show the math" disclosure.
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

  it('fires onShowMath from the "show the math" button; the math itself lives in the modal', () => {
    const onShowMath = vi.fn();
    render(<ScoreGauge quality={quality(72, sixPlusPenalty)} onShowMath={onShowMath} />);
    expect(screen.queryByText(/subtract 6 points/i)).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', {name: /why 72\? show the math/i}));
    expect(onShowMath).toHaveBeenCalledOnce();
  });

  it('renders no math button without an onShowMath callback', () => {
    render(<ScoreGauge quality={quality(72, sixPlusPenalty)} />);
    expect(screen.queryByRole('button', {name: /show the math/i})).not.toBeInTheDocument();
  });
});
