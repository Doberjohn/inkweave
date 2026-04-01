import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {VoteProgress} from '../VoteProgress';

describe('VoteProgress', () => {
  it('renders voted count', () => {
    render(<VoteProgress voted={5} skipped={2} />);
    expect(screen.getByText(/5 voted/)).toBeInTheDocument();
  });

  it('renders skipped count', () => {
    render(<VoteProgress voted={5} skipped={2} />);
    expect(screen.getByText(/2 skipped/)).toBeInTheDocument();
  });

  it('renders correct format with separator', () => {
    render(<VoteProgress voted={12} skipped={3} />);
    expect(screen.getByText('12 voted · 3 skipped')).toBeInTheDocument();
  });
});
