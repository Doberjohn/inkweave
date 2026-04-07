import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {DistributionBar} from '../DistributionBar';

describe('DistributionBar', () => {
  it('renders three segments with percentages', () => {
    render(<DistributionBar lower={3} right={14} higher={3} animate={false} />);
    expect(screen.getAllByText('15%')).toHaveLength(2);
    expect(screen.getByText('70%')).toBeInTheDocument();
  });

  it('renders labels below the bar', () => {
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} />);
    expect(screen.getByText('Should be lower')).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('Should be higher')).toBeInTheDocument();
  });

  it('handles all votes in one bucket', () => {
    render(<DistributionBar lower={0} right={10} higher={0} animate={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('rounds percentages to sum to exactly 100', () => {
    // 1/3 each = 33.33% → rounds to 33+33+33=99, correction bumps one to 34
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} />);
    expect(screen.getAllByText('33%')).toHaveLength(2);
    expect(screen.getByText('34%')).toBeInTheDocument();
  });

  it('handles single vote', () => {
    render(<DistributionBar lower={1} right={0} higher={0} animate={false} />);
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('returns null when total is zero', () => {
    const {container} = render(<DistributionBar lower={0} right={0} higher={0} animate={false} />);
    expect(container.firstChild).toBeNull();
  });

  it('hides labels when showLabels is false', () => {
    render(<DistributionBar lower={1} right={1} higher={1} animate={false} showLabels={false} />);
    expect(screen.queryByText('Should be lower')).not.toBeInTheDocument();
    expect(screen.queryByText('About right')).not.toBeInTheDocument();
    expect(screen.queryByText('Should be higher')).not.toBeInTheDocument();
  });
});
