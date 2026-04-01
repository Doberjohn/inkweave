import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {VoteStatusBanner} from '../VoteStatusBanner';

describe('VoteStatusBanner', () => {
  it('rate_limited: renders correct message', () => {
    render(<VoteStatusBanner type="rate_limited" />);
    expect(
      screen.getByText("You've reached the voting limit (30 per hour). Come back soon!"),
    ).toBeInTheDocument();
  });

  it('unavailable: renders correct message', () => {
    render(<VoteStatusBanner type="unavailable" />);
    expect(
      screen.getByText('Voting is currently unavailable. You can still browse pairs.'),
    ).toBeInTheDocument();
  });

  it('error: renders correct message', () => {
    render(<VoteStatusBanner type="error" />);
    expect(
      screen.getByText('Something went wrong submitting your vote.'),
    ).toBeInTheDocument();
  });

  it('has role="alert"', () => {
    render(<VoteStatusBanner type="error" />);
    expect(screen.getByRole('alert')).toBeInTheDocument();
  });

  it('error with onRetry: renders Retry button', () => {
    const onRetry = vi.fn();
    render(<VoteStatusBanner type="error" onRetry={onRetry} />);
    expect(screen.getByText('Retry')).toBeInTheDocument();
  });

  it('error without onRetry: no Retry button', () => {
    render(<VoteStatusBanner type="error" />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('rate_limited: no Retry button regardless of onRetry', () => {
    const onRetry = vi.fn();
    render(<VoteStatusBanner type="rate_limited" onRetry={onRetry} />);
    expect(screen.queryByText('Retry')).not.toBeInTheDocument();
  });

  it('clicking Retry calls onRetry callback', () => {
    const onRetry = vi.fn();
    render(<VoteStatusBanner type="error" onRetry={onRetry} />);
    fireEvent.click(screen.getByText('Retry'));
    expect(onRetry).toHaveBeenCalledOnce();
  });
});
