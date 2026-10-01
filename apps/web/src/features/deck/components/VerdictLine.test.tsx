import {describe, expect, it, vi} from 'vitest';
import {render, screen} from '@testing-library/react';
import {VerdictLine} from './VerdictLine';

describe('VerdictLine', () => {
  it('shows the tier word and score for the deck', () => {
    render(<VerdictLine archetype="aggro" archetypeConfidence={0.9} score={78} gameplan={undefined} onGameplanChange={vi.fn()} />);
    expect(screen.getByText('Strong')).toBeInTheDocument(); // scoreTier(78).label
    expect(screen.getByText('78')).toBeInTheDocument();
  });

  it('shows the low-score tier for a weak deck', () => {
    render(<VerdictLine archetype="control" archetypeConfidence={0.5} score={22} gameplan={undefined} onGameplanChange={vi.fn()} />);
    expect(screen.getByText('Needs work')).toBeInTheDocument();
    expect(screen.getByText('22')).toBeInTheDocument();
  });
});
