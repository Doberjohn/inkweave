import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {IconButton} from '../IconButton';

describe('IconButton', () => {
  it('renders a square touch target with the required accessible name', () => {
    render(<IconButton aria-label="Close">×</IconButton>);
    const btn = screen.getByRole('button', {name: 'Close'});
    expect(btn.style.width).toBe('44px');
    expect(btn.style.height).toBe('44px');
  });

  it('lifts surface and text color on hover', () => {
    render(<IconButton aria-label="Close">×</IconButton>);
    const btn = screen.getByRole('button');
    expect(btn.style.background).toBe('transparent');
    fireEvent.mouseEnter(btn);
    expect(btn.style.background).toBe('rgb(37, 37, 64)'); // COLORS.surfaceHover
    expect(btn.style.color).toBe('rgb(232, 232, 232)'); // COLORS.text
  });

  it('forwards clicks and honors a custom size', () => {
    const onClick = vi.fn();
    render(
      <IconButton aria-label="Close" size={36} onClick={onClick}>
        ×
      </IconButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn.style.width).toBe('36px');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('applies the uniform disabled recipe', () => {
    render(
      <IconButton aria-label="Close" disabled>
        ×
      </IconButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.style.opacity).toBe('0.4');
  });
});
