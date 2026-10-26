import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {FiltersButton} from '../FiltersButton';

describe('FiltersButton', () => {
  it("says its badge's count in its name, which screen readers otherwise never hear (#1000)", () => {
    render(<FiltersButton onClick={vi.fn()} activeCount={3} />);
    expect(screen.getByRole('button', {name: 'Filters, 3 on'})).toHaveTextContent(/^Filters3$/);
  });

  it('is plain Filters with nothing on, and no badge', () => {
    render(<FiltersButton onClick={vi.fn()} activeCount={0} />);
    expect(screen.getByRole('button', {name: 'Filters'})).toHaveTextContent(/^Filters$/);
  });

  it('presses through to its caller', () => {
    const onClick = vi.fn();
    render(<FiltersButton onClick={onClick} activeCount={0} />);
    fireEvent.click(screen.getByRole('button', {name: 'Filters'}));
    expect(onClick).toHaveBeenCalledOnce();
  });
});
