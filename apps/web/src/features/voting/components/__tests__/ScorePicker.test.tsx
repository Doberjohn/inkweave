import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {ScorePicker} from '../ScorePicker';

describe('ScorePicker', () => {
  const onChange = vi.fn();

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders all 10 score buttons', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    const buttons = screen.getAllByRole('radio');
    expect(buttons).toHaveLength(10);
  });

  it('each button has correct aria-label (Score 1 through Score 10)', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    for (let i = 1; i <= 10; i++) {
      expect(screen.getByLabelText(`Score ${i}`)).toBeInTheDocument();
    }
  });

  it('radiogroup has aria-label "Synergy score"', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    expect(screen.getByRole('radiogroup', {name: 'Synergy score'})).toBeInTheDocument();
  });

  it('clicking button calls onChange with correct score value', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText('Score 7'));
    expect(onChange).toHaveBeenCalledWith(7);
  });

  it('selected button has aria-checked="true"', () => {
    render(<ScorePicker value={5} onChange={onChange} />);
    expect(screen.getByLabelText('Score 5')).toHaveAttribute('aria-checked', 'true');
  });

  it('unselected buttons have aria-checked="false"', () => {
    render(<ScorePicker value={5} onChange={onChange} />);
    const unselected = [1, 2, 3, 4, 6, 7, 8, 9, 10];
    for (const score of unselected) {
      expect(screen.getByLabelText(`Score ${score}`)).toHaveAttribute('aria-checked', 'false');
    }
  });

  it('renders tier labels (Weak, Moderate, Strong, Perfect)', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    expect(screen.getByText('Weak')).toBeInTheDocument();
    expect(screen.getByText('Moderate')).toBeInTheDocument();
    expect(screen.getByText('Strong')).toBeInTheDocument();
    expect(screen.getByText('Perfect')).toBeInTheDocument();
  });

  it('null value: no button is aria-checked="true"', () => {
    render(<ScorePicker value={null} onChange={onChange} />);
    const buttons = screen.getAllByRole('radio');
    for (const button of buttons) {
      expect(button).toHaveAttribute('aria-checked', 'false');
    }
  });
});
