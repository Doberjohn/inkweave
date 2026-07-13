import {describe, expect, it} from 'vitest';
import {render, screen} from '@testing-library/react';
import {CostCurveStrip} from './CostCurveStrip';

describe('CostCurveStrip', () => {
  it('renders a labelled bar per bucket, zero-filling gaps', () => {
    render(<CostCurveStrip costCurve={{1: 2, 3: 4}} costCurveByInk={{1: {Amber: 2}, 3: {Amber: 1, Emerald: 3}}} />);
    expect(screen.getByTitle('2 cards at cost 1')).toBeInTheDocument();
    expect(screen.getByTitle('4 cards at cost 3')).toBeInTheDocument();
    // A bucket with no cards is still drawn (as a 0), not skipped.
    expect(screen.getByTitle('0 cards at cost 2')).toBeInTheDocument();
    // Costs >= 7 share the "7+" column.
    expect(screen.getByTitle('0 cards at cost 7+')).toBeInTheDocument();
  });

  it('renders nothing for an empty deck so a fresh build stays clean', () => {
    const {container} = render(<CostCurveStrip costCurve={{}} costCurveByInk={{}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
