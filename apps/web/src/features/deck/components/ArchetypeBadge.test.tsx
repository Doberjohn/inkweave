import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ArchetypeBadge} from './ArchetypeBadge';

describe('ArchetypeBadge', () => {
  it('renders the archetype label uppercased by style, plus its hint line', () => {
    render(<ArchetypeBadge archetype="midrange" confidence={0.8} />);
    expect(screen.getByText('Midrange')).toBeInTheDocument();
    expect(screen.getByText(/flexible threats/i)).toBeInTheDocument();
  });

  it('shows "Declared gameplan" when the user declared one', () => {
    render(<ArchetypeBadge archetype="ramp" confidence={1} declared />);
    expect(screen.getByText('Declared gameplan')).toBeInTheDocument();
  });

  it('reads "Detected" at high confidence', () => {
    render(<ArchetypeBadge archetype="aggro" confidence={0.75} />);
    expect(screen.getByText('Detected gameplan')).toBeInTheDocument();
  });

  it('hedges to "Likely" at middling confidence', () => {
    render(<ArchetypeBadge archetype="control" confidence={0.6} />);
    expect(screen.getByText('Likely gameplan')).toBeInTheDocument();
  });

  it('hedges to "Leaning" when the classifier is unsure', () => {
    render(<ArchetypeBadge archetype="combo" confidence={0.3} />);
    expect(screen.getByText('Leaning gameplan')).toBeInTheDocument();
  });
});
