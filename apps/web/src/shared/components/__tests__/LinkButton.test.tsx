import {describe, expect, it, vi} from 'vitest';
import {fireEvent, render, screen} from '@testing-library/react';
import {LinkButton} from '../LinkButton';

describe('LinkButton', () => {
  it('renders a bare text button and forwards clicks', () => {
    const onClick = vi.fn();
    render(<LinkButton onClick={onClick}>Show the math</LinkButton>);
    const btn = screen.getByRole('button', {name: 'Show the math'});
    expect(btn.style.background).toBe('transparent');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('gold tone brightens on hover', () => {
    render(<LinkButton>Undo</LinkButton>);
    const btn = screen.getByRole('button');
    expect(btn.style.color).toBe('rgb(255, 185, 0)'); // COLORS.primary
    fireEvent.mouseEnter(btn);
    expect(btn.style.color).toBe('rgb(255, 201, 51)'); // COLORS.primaryHover
  });

  it('muted tone lifts to full text color, with optional underline', () => {
    render(
      <LinkButton tone="muted" underlineOnHover>
        Clear all
      </LinkButton>,
    );
    const btn = screen.getByRole('button');
    expect(btn.style.color).toBe('rgb(144, 161, 185)'); // COLORS.textMuted
    fireEvent.mouseEnter(btn);
    expect(btn.style.color).toBe('rgb(232, 232, 232)'); // COLORS.text
    expect(btn.style.textDecoration).toBe('underline');
  });

  it('applies the uniform disabled recipe', () => {
    render(<LinkButton disabled>Undo</LinkButton>);
    const btn = screen.getByRole('button');
    expect(btn).toBeDisabled();
    expect(btn.style.opacity).toBe('0.4');
    expect(btn.style.cursor).toBe('not-allowed');
  });
});
