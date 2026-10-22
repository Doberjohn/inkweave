import {describe, it, expect, vi} from 'vitest';
import {act, render, screen, fireEvent} from '@testing-library/react';
import {NavArrowButton} from '../NavArrowButton';
import {DISABLED_STYLE} from '../../constants';

/** An edge disc's growth: its `scale`, 1 at rest. */
const scaleOf = (button: HTMLElement) => Number(button.style.scale);

describe('NavArrowButton', () => {
  it('stays a bare arrow, named for screen readers', () => {
    render(<NavArrowButton direction="prev" label="Previous card" onClick={() => {}} />);
    expect(screen.getByRole('button', {name: 'Previous card'}).textContent).toBe('');
  });

  it('stays focusable at the end, dimmed and announced as unavailable, and a press does nothing', () => {
    // Not natively disabled (#790): that drops the focus it holds to the page.
    const onClick = vi.fn();
    render(<NavArrowButton direction="next" label="Next spread" onClick={onClick} atEnd />);
    const button = screen.getByRole('button', {name: 'Next spread'});
    expect(button).toBeEnabled();
    expect(button).toHaveAttribute('aria-disabled', 'true');
    expect(button).toHaveStyle({opacity: DISABLED_STYLE.opacity, cursor: DISABLED_STYLE.cursor});
    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  describe("as the disc on a spread's edge (owner, 2026-10-22)", () => {
    it('grows from 28px to 40 while a mouse rests on it', () => {
      render(<NavArrowButton direction="next" label="Next spread" onClick={() => {}} edge />);
      const button = screen.getByRole('button', {name: 'Next spread'});
      expect(button).toHaveStyle({width: '28px', height: '28px'});
      expect(scaleOf(button)).toBe(1);
      fireEvent.mouseEnter(button);
      expect(scaleOf(button) * 28).toBeCloseTo(40);
      fireEvent.mouseLeave(button);
      expect(scaleOf(button)).toBe(1);
    });

    it("grows on the keyboard's focus, and not on a click's", () => {
      render(<NavArrowButton direction="next" label="Next spread" onClick={() => {}} edge />);
      const button = screen.getByRole('button', {name: 'Next spread'});
      // `:focus-visible` follows the last input: a key, then a mouse press.
      fireEvent.keyDown(document.body, {key: 'Tab'});
      act(() => button.focus());
      expect(scaleOf(button)).toBeGreaterThan(1);
      act(() => button.blur());
      fireEvent.mouseDown(button);
      act(() => button.focus());
      expect(scaleOf(button)).toBe(1);
    });

    it("stays small at the binder's end", () => {
      render(<NavArrowButton direction="prev" label="Previous spread" onClick={() => {}} edge atEnd />);
      const button = screen.getByRole('button', {name: 'Previous spread'});
      fireEvent.mouseEnter(button);
      expect(scaleOf(button)).toBe(1);
    });
  });
});
