import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {QuickVoteControl} from '../QuickVoteControl';
import type {AccuracyDistribution} from '../../../../shared/lib/supabase';

const mockVote = vi.fn();

beforeEach(() => {
  mockVote.mockClear();
});

describe('QuickVoteControl', () => {
  it('renders nothing when state is hidden', () => {
    const {container} = render(
      <QuickVoteControl state="hidden" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders three vote buttons in ready state', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    expect(screen.getByText('Do you agree with this score?')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Should be lower'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'About right'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Should be higher'})).toBeInTheDocument();
  });

  it('calls onVote with -1 when "Should be lower" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Should be lower'}));
    expect(mockVote).toHaveBeenCalledWith(-1);
  });

  it('calls onVote with 0 when "About right" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'About right'}));
    expect(mockVote).toHaveBeenCalledWith(0);
  });

  it('calls onVote with 1 when "Should be higher" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Should be higher'}));
    expect(mockVote).toHaveBeenCalledWith(1);
  });

  it('shows optimistic confirmation during submitting state', () => {
    render(
      <QuickVoteControl state="submitting" onVote={mockVote} distribution={null} userChoice={0} error={null} />,
    );
    expect(screen.getByText(/You voted:/)).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('Loading community votes…')).toBeInTheDocument();
  });

  it('shows distribution bar and confirmation in result state', () => {
    const dist: AccuracyDistribution = {lower: 3, right: 14, higher: 3, total: 20};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} />,
    );
    expect(screen.getByText(/You voted:/)).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('20 votes on this pair')).toBeInTheDocument();
  });

  it('shows first voter badge without vote count when total is 1', () => {
    const dist: AccuracyDistribution = {lower: 0, right: 1, higher: 0, total: 1};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} />,
    );
    expect(screen.getByText('First to rate this pair!')).toBeInTheDocument();
    expect(screen.queryByText(/votes? on this pair/)).not.toBeInTheDocument();
  });

  it('shows error message and re-enables buttons on error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="submission_failed" />,
    );
    expect(screen.getByText('Something went wrong, try again')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Should be lower'})).not.toBeDisabled();
  });

  it('disables vote buttons when rate limited', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="rate_limited" />,
    );
    expect(screen.getByRole('button', {name: 'Should be lower'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'About right'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Should be higher'})).toBeDisabled();
  });

  it('shows loading text when distribution is null in result state', () => {
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={null} userChoice={0} error={null} />,
    );
    expect(screen.getByText(/You voted:/)).toBeInTheDocument();
    expect(screen.getByText('About right')).toBeInTheDocument();
    expect(screen.getByText('Loading community votes…')).toBeInTheDocument();
    expect(screen.queryByText(/votes on this pair/)).not.toBeInTheDocument();
  });

  it('shows rate limit message on rate_limited error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="rate_limited" />,
    );
    expect(screen.getByText("You're voting fast! Try again in a bit.")).toBeInTheDocument();
  });

  it('shows unavailable text when distribution fetch failed', () => {
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={null} distributionFailed userChoice={0} error={null} />,
    );
    expect(screen.getByText('Community votes unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Loading community votes…')).not.toBeInTheDocument();
  });

});
