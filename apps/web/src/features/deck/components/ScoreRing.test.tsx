import {describe, expect, it} from 'vitest';
import {render} from '@testing-library/react';
import {ScoreRing} from './ScoreRing';

/** The colored arc is the second circle (the first is the faint track). */
function arcFraction(container: HTMLElement): number {
  const arc = container.querySelectorAll('circle')[1];
  const [len, circ] = (arc.getAttribute('stroke-dasharray') ?? '').split(' ').map(Number);
  return len / circ;
}

describe('ScoreRing', () => {
  it('renders the score centered in the ring', () => {
    const {container} = render(<ScoreRing score={72} color="#fff" size={64} />);
    expect(container.querySelector('text')?.textContent).toBe('72');
  });

  it('fills the arc proportional to the score', () => {
    const {container} = render(<ScoreRing score={50} color="#fff" size={64} />);
    expect(arcFraction(container)).toBeCloseTo(0.5, 2);
  });

  it('clamps a score above 100 to a full ring', () => {
    const {container} = render(<ScoreRing score={120} color="#fff" size={64} />);
    expect(container.querySelector('text')?.textContent).toBe('100');
    expect(arcFraction(container)).toBeCloseTo(1, 2);
  });

  it('clamps a negative score to an empty ring', () => {
    const {container} = render(<ScoreRing score={-5} color="#fff" size={64} />);
    expect(container.querySelector('text')?.textContent).toBe('0');
    expect(arcFraction(container)).toBeCloseTo(0, 2);
  });
});
