import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {DistributionBar} from '../DistributionBar';

// Solution B: percentages live in the legend below the bar (not inside the bar
// segments). Tests assert on legend text rather than segment-internal text.

describe('DistributionBar', () => {
  it('renders three legend entries with percentages', () => {
    render(<DistributionBar lower={3} right={14} higher={3} animate={false} />);
    // 3/20=15%, 14/20=70%, 3/20=15% — legend renders "Lower 15%", "Fair 70%", "Higher 15%"
    expect(screen.getByText('Lower 15%')).toBeInTheDocument();
    expect(screen.getByText('Fair 70%')).toBeInTheDocument();
    expect(screen.getByText('Higher 15%')).toBeInTheDocument();
  });

  it('renders short legend labels (Lower / Fair / Higher)', () => {
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} />);
    // Rounding correction can land on any of the three (whichever sorts largest).
    // Just verify each label appears once with a 33% or 34% number.
    expect(screen.getByText(/^Lower 3[34]%$/)).toBeInTheDocument();
    expect(screen.getByText(/^Fair 3[34]%$/)).toBeInTheDocument();
    expect(screen.getByText(/^Higher 3[34]%$/)).toBeInTheDocument();
  });

  it('handles all votes in one bucket', () => {
    render(<DistributionBar lower={0} right={10} higher={0} animate={false} />);
    expect(screen.getByText(/Fair\s+100%/)).toBeInTheDocument();
    expect(screen.queryByText(/Lower/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Higher/)).not.toBeInTheDocument();
  });

  it('rounds percentages to sum to exactly 100', () => {
    // 1/3 each = 33.33% → rounds to 33+33+33=99, correction bumps the largest to 34
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} />);
    expect(screen.getAllByText(/33%/)).toHaveLength(2);
    expect(screen.getByText(/34%/)).toBeInTheDocument();
  });

  it('handles single vote', () => {
    render(<DistributionBar lower={1} right={0} higher={0} animate={false} />);
    expect(screen.getByText(/Lower\s+100%/)).toBeInTheDocument();
  });

  it('returns null when total is zero', () => {
    const {container} = render(<DistributionBar lower={0} right={0} higher={0} animate={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides legend when showLabels is false', () => {
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} showLabels={false} />);
    expect(screen.queryByText(/Lower/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Fair/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Higher/)).not.toBeInTheDocument();
  });
});
