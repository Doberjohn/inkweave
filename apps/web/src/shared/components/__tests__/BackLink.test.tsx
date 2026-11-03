import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {COLORS} from '../../constants';
import {BackLink} from '../BackLink';

describe('BackLink', () => {
  it('is named by its label alone, the arrow hidden from screen readers', () => {
    render(<BackLink onClick={vi.fn()} label="Back to all synergies" />);
    expect(screen.getByRole('button', {name: 'Back to all synergies'})).toBeTruthy();
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

  it('takes the brand gold under the pointer, not the legacy accent', () => {
    render(<BackLink onClick={vi.fn()} label="Back" />);
    const link = screen.getByRole('button', {name: 'Back'});
    expect(link).toHaveStyle({color: COLORS.textMuted});
    fireEvent.mouseEnter(link);
    expect(link).toHaveStyle({color: COLORS.primary});
  });

  it('never submits a form it sits in', () => {
    const onSubmit = vi.fn((event: React.FormEvent) => event.preventDefault());
    render(
      <form onSubmit={onSubmit}>
        <BackLink onClick={vi.fn()} label="Back" />
      </form>,
    );
    fireEvent.click(screen.getByRole('button', {name: 'Back'}));
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
