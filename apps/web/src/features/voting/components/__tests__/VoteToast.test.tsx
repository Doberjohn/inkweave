import {describe, it, expect, vi, beforeEach, afterEach} from 'vitest';
import {render, screen, fireEvent, act} from '@testing-library/react';
import {VoteToast} from '../VoteToast';
import type {VoteToastData} from '../VoteToast';
import type {Score} from '../../../../shared/lib/supabase';

vi.mock('../../../synergies/utils/scoreUtils', () => ({
  getStrengthTier: (score: number) => ({
    label: score >= 9.5 ? 'Perfect' : score >= 7 ? 'Strong' : score >= 4 ? 'Moderate' : 'Weak',
    color: '#fbbf24',
    bg: '#3d3010',
  }),
}));

function makeData(overrides: Partial<VoteToastData> = {}): VoteToastData {
  return {
    cardAName: 'Elsa - Ice Queen',
    cardBName: 'Anna - Brave Princess',
    userScore: 7 as Score,
    engineScore: 7,
    ...overrides,
  };
}

describe('VoteToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders "Vote submitted" text', () => {
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Vote submitted')).toBeTruthy();
  });

  it('has role="status" with aria-live="polite"', () => {
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} />);
    const status = screen.getByRole('status');
    expect(status).toBeTruthy();
    expect(status.getAttribute('aria-live')).toBe('polite');
  });

  it('shows card names', () => {
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} />);
    expect(screen.getByText('Elsa - Ice Queen + Anna - Brave Princess')).toBeTruthy();
  });

  it('shows user score', () => {
    render(<VoteToast data={makeData({userScore: 8 as Score})} onDismiss={vi.fn()} />);
    expect(screen.getByText('You:')).toBeTruthy();
    expect(screen.getByText('8')).toBeTruthy();
  });

  it('shows engine score', () => {
    render(<VoteToast data={makeData({engineScore: 6})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Engine:')).toBeTruthy();
    expect(screen.getByText('6')).toBeTruthy();
  });

  it('shows "Exact match!" when scores are equal', () => {
    render(<VoteToast data={makeData({userScore: 7 as Score, engineScore: 7})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Exact match!')).toBeTruthy();
  });

  it('shows "Close match!" when diff is 1', () => {
    render(<VoteToast data={makeData({userScore: 7 as Score, engineScore: 8})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Close match!')).toBeTruthy();
  });

  it('shows "Hot take!" when diff >= 5', () => {
    render(<VoteToast data={makeData({userScore: 10 as Score, engineScore: 5})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Hot take!')).toBeTruthy();
  });

  it('shows "You rated higher" when user > engine (diff 2-4)', () => {
    render(<VoteToast data={makeData({userScore: 9 as Score, engineScore: 6})} onDismiss={vi.fn()} />);
    expect(screen.getByText('You rated higher')).toBeTruthy();
  });

  it('shows "You rated lower" when user < engine (diff 2-4)', () => {
    render(<VoteToast data={makeData({userScore: 4 as Score, engineScore: 7})} onDismiss={vi.fn()} />);
    expect(screen.getByText('You rated lower')).toBeTruthy();
  });

  it('shows streak text when streak >= 2', () => {
    render(<VoteToast data={makeData({userScore: 7 as Score, engineScore: 7, streak: 3})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Exact match! \u00b7 3 in a row!')).toBeTruthy();
  });

  it('does not show streak when streak < 2', () => {
    render(<VoteToast data={makeData({userScore: 7 as Score, engineScore: 7, streak: 1})} onDismiss={vi.fn()} />);
    expect(screen.getByText('Exact match!')).toBeTruthy();
    expect(screen.queryByText(/in a row/)).toBeNull();
  });

  it('renders Undo button when onUndo provided', () => {
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} onUndo={vi.fn()} />);
    expect(screen.getByText('Undo')).toBeTruthy();
  });

  it('does not render Undo button when onUndo undefined', () => {
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} />);
    expect(screen.queryByText('Undo')).toBeNull();
  });

  it('clicking Undo calls onUndo', () => {
    const onUndo = vi.fn();
    render(<VoteToast data={makeData()} onDismiss={vi.fn()} onUndo={onUndo} />);
    fireEvent.click(screen.getByText('Undo'));
    expect(onUndo).toHaveBeenCalledTimes(1);
  });

  it('auto-dismisses: calls onDismiss after timeout', () => {
    const onDismiss = vi.fn();
    render(<VoteToast data={makeData()} onDismiss={onDismiss} />);
    expect(onDismiss).not.toHaveBeenCalled();

    // The component uses DISMISS_MS (3000) for the exit trigger + ENTER_MS (300) for the remove
    act(() => {
      vi.advanceTimersByTime(3300);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should determine correct reaction for edge case scores', () => {
    const onDismiss = vi.fn();

    // diff=2, user > engine → "You rated higher" (just past "close match" boundary)
    const {unmount: u1} = render(<VoteToast data={makeData({userScore: 9 as Score, engineScore: 7})} onDismiss={onDismiss} />);
    expect(screen.getByText(/You rated higher/)).toBeInTheDocument();
    u1();

    // diff=2, user < engine → "You rated lower"
    const {unmount: u2} = render(<VoteToast data={makeData({userScore: 5 as Score, engineScore: 7})} onDismiss={onDismiss} />);
    expect(screen.getByText(/You rated lower/)).toBeInTheDocument();
    u2();

    // diff=4, user > engine → still "You rated higher" (one below hot take threshold)
    const {unmount: u3} = render(<VoteToast data={makeData({userScore: 8 as Score, engineScore: 4})} onDismiss={onDismiss} />);
    expect(screen.getByText(/You rated higher/)).toBeInTheDocument();
    u3();

    // diff=5 → "Hot take!" (exact boundary)
    const {unmount: u4} = render(<VoteToast data={makeData({userScore: 10 as Score, engineScore: 5})} onDismiss={onDismiss} />);
    expect(screen.getByText(/Hot take!/)).toBeInTheDocument();
    u4();

    // diff=9 (maximum possible) → "Hot take!"
    render(<VoteToast data={makeData({userScore: 1 as Score, engineScore: 10})} onDismiss={onDismiss} />);
    expect(screen.getByText(/Hot take!/)).toBeInTheDocument();
  });
});
