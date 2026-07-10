import type {ComponentProps} from 'react';
import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {QuantityStepper} from './QuantityStepper';

function renderStepper(props: Partial<ComponentProps<typeof QuantityStepper>> = {}) {
  const handlers = {onIncrement: vi.fn(), onDecrement: vi.fn()};
  render(<QuantityStepper value={2} label="Pocahontas" {...handlers} {...props} />);
  return handlers;
}

describe('QuantityStepper', () => {
  it('calls onIncrement when the + is clicked', () => {
    const {onIncrement} = renderStepper();
    fireEvent.click(screen.getByRole('button', {name: /add one copy of pocahontas/i}));
    expect(onIncrement).toHaveBeenCalledTimes(1);
  });

  it('calls onDecrement when the − is clicked', () => {
    const {onDecrement} = renderStepper();
    fireEvent.click(screen.getByRole('button', {name: /remove one copy of pocahontas/i}));
    expect(onDecrement).toHaveBeenCalledTimes(1);
  });

  it('disables the + and suppresses onIncrement when incrementDisabled', () => {
    const {onIncrement} = renderStepper({incrementDisabled: true, disabledReason: 'Maximum 4 copies'});
    const plus = screen.getByRole('button', {name: /maximum 4 copies/i});
    expect(plus).toBeDisabled();
    fireEvent.click(plus);
    expect(onIncrement).not.toHaveBeenCalled();
  });

  it('exposes the disabledReason via the disabled + aria-label', () => {
    renderStepper({incrementDisabled: true, disabledReason: 'Maximum 4 copies'});
    expect(screen.getByRole('button', {name: 'Maximum 4 copies'})).toBeInTheDocument();
  });

  it('renders the current value', () => {
    renderStepper({value: 3});
    expect(screen.getByText('3')).toBeInTheDocument();
  });

  it('uses the label in both step aria-labels', () => {
    renderStepper({label: 'Mickey Mouse'});
    expect(screen.getByRole('button', {name: 'Add one copy of Mickey Mouse'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Remove one copy of Mickey Mouse'})).toBeInTheDocument();
  });
});
