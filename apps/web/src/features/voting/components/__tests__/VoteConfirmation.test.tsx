import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, act} from '@testing-library/react';
import {VoteConfirmation} from '../VoteConfirmation';
import type {Score} from '../../../../shared/lib/supabase';

vi.mock('../../../synergies/utils/scoreUtils', () => ({
  getStrengthTier: (score: number) => ({
    label: score >= 9.5 ? 'Perfect' : score >= 7 ? 'Strong' : score >= 4 ? 'Moderate' : 'Weak',
    color: '#fbbf24',
    bg: '#3d3010',
  }),
}));

const defaultProps = {
  score: 7 as Score,
  engineScore: 8,
  whoCarries: 'a' as const,
  cardAName: 'Elsa - Ice Queen',
  cardBName: 'Anna - Brave Princess',
  onComplete: vi.fn(),
};

describe('VoteConfirmation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "Vote recorded!" text', () => {
    render(<VoteConfirmation {...defaultProps} />);
    expect(screen.getByText('Vote recorded!')).toBeTruthy();
  });

  it('shows user score', () => {
    render(<VoteConfirmation {...defaultProps} />);
    expect(screen.getByText('Your rating')).toBeTruthy();
    expect(screen.getByText('7')).toBeTruthy();
  });

  it('shows engine score', () => {
    render(<VoteConfirmation {...defaultProps} />);
    expect(screen.getByText('Engine score')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows "vs" separator', () => {
    render(<VoteConfirmation {...defaultProps} />);
    expect(screen.getByText('vs')).toBeTruthy();
  });

  it('shows carries as card A name when whoCarries="a"', () => {
    render(<VoteConfirmation {...defaultProps} whoCarries="a" />);
    expect(screen.getByText('Carries:')).toBeTruthy();
    expect(screen.getByText('Elsa - Ice Queen')).toBeTruthy();
  });

  it('shows carries as card B name when whoCarries="b"', () => {
    render(<VoteConfirmation {...defaultProps} whoCarries="b" />);
    expect(screen.getByText('Carries:')).toBeTruthy();
    expect(screen.getByText('Anna - Brave Princess')).toBeTruthy();
  });

  it('shows carries as "Both equally" when whoCarries="both"', () => {
    render(<VoteConfirmation {...defaultProps} whoCarries="both" />);
    expect(screen.getByText('Carries:')).toBeTruthy();
    expect(screen.getByText('Both equally')).toBeTruthy();
  });

  it('does not show carries section when whoCarries is null', () => {
    render(<VoteConfirmation {...defaultProps} whoCarries={null} />);
    expect(screen.queryByText('Carries:')).toBeNull();
  });

  it('shows "Loading next pair..." text', () => {
    render(<VoteConfirmation {...defaultProps} />);
    expect(screen.getByText('Loading next pair...')).toBeTruthy();
  });

  it('auto-advances: calls onComplete after timeout', () => {
    const onComplete = vi.fn();
    render(<VoteConfirmation {...defaultProps} onComplete={onComplete} />);
    expect(onComplete).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
