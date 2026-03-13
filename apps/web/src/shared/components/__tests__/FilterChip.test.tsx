import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FilterChip} from '../FilterChip';

describe('FilterChip', () => {
  it('should render label text and dismiss button', () => {
    render(<FilterChip label="Amber" onDismiss={vi.fn()} />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('Amber');
    expect(btn).toHaveTextContent('×');
  });

  it('should call onDismiss when clicked', () => {
    const onDismiss = vi.fn();
    render(<FilterChip label="Ruby" onDismiss={onDismiss} />);
    fireEvent.click(screen.getByRole('button'));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it('should use compact padding in mobile mode', () => {
    const {container} = render(<FilterChip label="Test" onDismiss={vi.fn()} isMobile />);
    const btn = container.querySelector('button')!;
    expect(btn.style.padding).toBe('5px 8px 5px 10px');
  });
});
