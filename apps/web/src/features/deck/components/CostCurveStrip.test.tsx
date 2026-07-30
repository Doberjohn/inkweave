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

  it('floors a bar tall enough to fit every band, so no ink is clipped away', () => {
    // The 2-drop is 10% of the chart (~5px) and cannot hold two 8px bands, so
    // the bar floors at 2 bands x MIN_BAND_PX = 16px.
    const {container} = render(
      <CostCurveStrip costCurve={{1: 20, 2: 2}} costCurveByInk={{1: {Amber: 20}, 2: {Amber: 1, Emerald: 1}}} />,
    );
    const twoDrop = container.querySelector<HTMLElement>('[data-bucket="2"]')!;
    expect(twoDrop.style.minHeight).toBe('16px');
    expect((twoDrop.firstElementChild as HTMLElement).style.minHeight).toBe('8px');
  });
});
