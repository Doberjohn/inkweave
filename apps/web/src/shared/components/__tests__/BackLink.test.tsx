import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {BackLink} from '../BackLink';

describe('BackLink', () => {
  it('renders label text with arrow', () => {
    render(<BackLink onClick={vi.fn()} label="Back to all synergies" />);
    expect(screen.getByText(/Back to all synergies/)).toBeTruthy();
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<BackLink onClick={onClick} label="Back" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('renders as a button element', () => {
    render(<BackLink onClick={vi.fn()} label="Back" />);
    expect(screen.getByRole('button')).toBeTruthy();
  });
});
