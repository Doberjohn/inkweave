import {describe, expect, it} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {CostCurveStrip} from './CostCurveStrip';

describe('CostCurveStrip', () => {
  it('renders an axis label per bucket, zero-filling gaps', () => {
    render(<CostCurveStrip costCurve={{1: 2, 3: 4}} costCurveByInk={{1: {Amber: 2}, 3: {Amber: 1, Emerald: 3}}} />);
    // A bucket with no cards still gets its column and label, rather than being skipped.
    expect(screen.getByText('2')).toBeInTheDocument();
    // Costs >= 7 share one capped column.
    expect(screen.getByText('7+')).toBeInTheDocument();
  });

  it('names each ink band with its ink and count for assistive tech', () => {
    render(<CostCurveStrip costCurve={{3: 4}} costCurveByInk={{3: {Amber: 1, Emerald: 3}}} />);
    expect(screen.getByRole('img', {name: 'Emerald, 3 cards at cost 3'})).toBeInTheDocument();
    // Singular, because "1 cards" reads as a bug.
    expect(screen.getByRole('img', {name: 'Amber, 1 card at cost 3'})).toBeInTheDocument();
  });

  it('shows the hovered ink and its count, and exposes no competing native title', () => {
    const {container} = render(<CostCurveStrip costCurve={{3: 4}} costCurveByInk={{3: {Amber: 1, Emerald: 3}}} />);
    // The native title would fire from the ancestor bar a second after our own
    // tooltip, showing different content for one gesture.
    expect(container.querySelector('[title]')).toBeNull();

    const band = screen.getByRole('img', {name: 'Emerald, 3 cards at cost 3'});
    // Hovering the band shows its tip; the handler lives on Tooltip's wrapper.
    fireEvent.mouseEnter(band);
    const tip = screen.getByRole('tooltip');
    expect(tip).toHaveTextContent('Emerald');
    expect(tip).toHaveTextContent('3');
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
    // firstElementChild is Tooltip's wrapper span: the band's floor lives there
    // because that span is the flex item, not the band div inside it.
    expect((twoDrop.firstElementChild as HTMLElement).style.minHeight).toBe('8px');
  });
});
