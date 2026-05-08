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
    expect(screen.getByRole('button', {name: 'Lower'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Fair'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Higher'})).toBeInTheDocument();
  });

  it('calls onVote with -1 when "Lower" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Lower'}));
    expect(mockVote).toHaveBeenCalledWith(-1);
  });

  it('calls onVote with 0 when "Fair" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Fair'}));
    expect(mockVote).toHaveBeenCalledWith(0);
  });

  it('calls onVote with 1 when "Higher" is clicked', () => {
    render(
      <QuickVoteControl state="ready" onVote={mockVote} distribution={null} userChoice={null} error={null} />,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Higher'}));
    expect(mockVote).toHaveBeenCalledWith(1);
  });

  it('keeps prompt layout + disables buttons during submitting state', () => {
    render(
      <QuickVoteControl state="submitting" onVote={mockVote} distribution={null} userChoice={0} error={null} />,
    );
    expect(screen.getByRole('button', {name: 'Lower'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Fair'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Higher'})).toBeDisabled();
  });

  it('renders dist segment + affirmation in result state (no prompt or buttons)', () => {
    const dist: AccuracyDistribution = {lower: 3, right: 14, higher: 3, total: 20};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} engineScore={9} />,
    );
    // Dist segment stays visible above the affirmation
    expect(screen.getByText(/How the community rates Inkweave's score/)).toBeInTheDocument();
    // Affirmation replaces the prompt + buttons (which used to dead-end after voting)
    expect(screen.getByText('Thanks for your quick vote')).toBeInTheDocument();
    expect(screen.getByText('You picked: Fair')).toBeInTheDocument();
    expect(screen.queryByText("How accurate is Inkweave's score of 9?")).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Fair'})).not.toBeInTheDocument();
  });

  it('shows dist segment + affirmation when total is 1 (first voter)', () => {
    const dist: AccuracyDistribution = {lower: 0, right: 1, higher: 0, total: 1};
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={dist} userChoice={0} error={null} engineScore={9} />,
    );
    expect(screen.getByText(/How the community rates Inkweave's score/)).toBeInTheDocument();
    expect(screen.getByText('Thanks for your quick vote')).toBeInTheDocument();
  });

  it('shows error message and re-enables buttons on error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="submission_failed" />,
    );
    expect(screen.getByText('Something went wrong, try again')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Lower'})).not.toBeDisabled();
  });

  it('disables vote buttons when rate limited', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="rate_limited" />,
    );
    expect(screen.getByRole('button', {name: 'Lower'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Fair'})).toBeDisabled();
    expect(screen.getByRole('button', {name: 'Higher'})).toBeDisabled();
  });

  it('hides dist segment when distribution is null in result state — affirmation alone', () => {
    render(
      <QuickVoteControl state="result" onVote={mockVote} distribution={null} userChoice={0} error={null} engineScore={9} />,
    );
    // No dist segment without data — just the affirmation tile
    expect(screen.queryByText(/How the community rates Inkweave's score/)).not.toBeInTheDocument();
    expect(screen.getByText('Thanks for your quick vote')).toBeInTheDocument();
    expect(screen.getByText('You picked: Fair')).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Fair'})).not.toBeInTheDocument();
  });

  it('shows rate limit message on rate_limited error', () => {
    render(
      <QuickVoteControl state="error" onVote={mockVote} distribution={null} userChoice={null} error="rate_limited" />,
    );
    expect(screen.getByText("You're rating fast! Try again in a bit.")).toBeInTheDocument();
  });

});
