import type {ComponentProps} from 'react';
import {describe, it, expect, vi, afterEach} from 'vitest';
import {act, render, screen, fireEvent} from '@testing-library/react';
import {QuantityStepper} from './QuantityStepper';

function renderStepper(props: Partial<ComponentProps<typeof QuantityStepper>> = {}) {
  const handlers = {onIncrement: vi.fn(), onDecrement: vi.fn()};
  render(<QuantityStepper value={2} label="Pocahontas" {...handlers} {...props} />);
  return handlers;
}

/** Reduced motion on; the returned call turns it off, as a change to the OS setting would. */
function stubReducedMotion() {
  let reduce = true;
  const listeners = new Set<() => void>();
  vi.stubGlobal(
    'matchMedia',
    vi.fn((query: string) => ({
      matches: reduce && query.includes('reduce'),
      addEventListener: (_type: string, listener: () => void) => listeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => listeners.delete(listener),
    })),
  );
  return () => {
    reduce = false;
    act(() => listeners.forEach((listener) => listener()));
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

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

  it("drops a parent's pop under reduced motion", () => {
    // The pop is set inline, where index.css's reduced-motion block can't reach it (#790).
    stubReducedMotion();
    renderStepper({popping: true, onPopEnd: vi.fn()});
    expect(screen.getByText('2').style.animation).toBe('');
  });

  it('leaves no pop of its own under reduced motion, to play once the setting changes', () => {
    // The animation's end is what clears the pop, and under reduced motion none runs.
    const allowMotion = stubReducedMotion();
    renderStepper();
    fireEvent.click(screen.getByRole('button', {name: /add one copy of pocahontas/i}));
    allowMotion();
    expect(screen.getByText('2').style.animation).toBe('');
  });

  it('uses the label in both step aria-labels', () => {
    renderStepper({label: 'Mickey Mouse'});
    expect(screen.getByRole('button', {name: 'Add one copy of Mickey Mouse'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Remove one copy of Mickey Mouse'})).toBeInTheDocument();
  });
});
