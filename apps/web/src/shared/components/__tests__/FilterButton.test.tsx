import {describe, it, expect} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {COLORS, hexToRgb, INK_COLORS} from '../../constants';
import {FilterButton} from '../FilterButton';

// The styling assertions read jsdom's normalized `rgb(r, g, b)` form, so both the
// prop and its expectation derive from the SAME token: a hand-written hex/rgb pair
// silently rots when the palette moves (the ink repalette orphaned the old ones).
const AMBER = INK_COLORS.Amber;

describe('FilterButton', () => {
  it('should render children', () => {
    render(
      <FilterButton active={false} onClick={() => {}}>
        Test
      </FilterButton>,
    );

    expect(screen.getByRole('button', {name: /test/i})).toBeInTheDocument();
  });

  it('should set aria-pressed based on active prop', () => {
    const {rerender} = render(
      <FilterButton active={false} onClick={() => {}}>
        Test
      </FilterButton>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');

    rerender(
      <FilterButton active={true} onClick={() => {}}>
        Test
      </FilterButton>,
    );

    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
  });

  it('should call onClick when clicked', () => {
    const onClick = vi.fn();
    render(
      <FilterButton active={false} onClick={onClick}>
        Test
      </FilterButton>,
    );

    fireEvent.click(screen.getByRole('button'));

    expect(onClick).toHaveBeenCalledOnce();
  });

  describe('Active state styling', () => {
    it('should use activeBgColor for background when active', () => {
      render(
        <FilterButton
          active={true}
          onClick={() => {}}
          activeColor={AMBER.border}
          activeBgColor={AMBER.bg}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.background).toContain(hexToRgb(AMBER.bg));
    });

    it('should fall back to activeColor for background when activeBgColor not provided', () => {
      render(
        <FilterButton active={true} onClick={() => {}} activeColor={COLORS.primary}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.background).toContain(hexToRgb(COLORS.primary));
    });

    it('should use activeColor for border when active', () => {
      render(
        <FilterButton
          active={true}
          onClick={() => {}}
          activeColor={AMBER.border}
          activeBgColor={AMBER.bg}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      // Border should reference the activeColor (bright accent), not the bg color
      expect(button.style.border).toContain(hexToRgb(AMBER.border));
    });

    it('should have a box-shadow when active', () => {
      render(
        <FilterButton active={true} onClick={() => {}} activeColor={AMBER.border}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.boxShadow).not.toBe('none');
      expect(button.style.boxShadow).toBeTruthy();
    });

    it('should have no box-shadow when inactive', () => {
      render(
        <FilterButton active={false} onClick={() => {}}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.boxShadow).toBe('none');
    });

    it('should use inactiveColor for background when not active', () => {
      render(
        <FilterButton active={false} onClick={() => {}} inactiveColor={COLORS.gray100}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.background).toContain(hexToRgb(COLORS.gray100));
    });

    it('should have transparent border when inactive', () => {
      render(
        <FilterButton active={false} onClick={() => {}}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.border).toContain('transparent');
    });
  });

  describe('Sizes', () => {
    it('should apply sm size styles by default', () => {
      render(
        <FilterButton active={false} onClick={() => {}}>
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.padding).toBe('0px');
    });

    it('should apply md size styles when specified', () => {
      render(
        <FilterButton active={false} onClick={() => {}} size="md">
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      expect(button.style.padding).toBe('10px 16px');
    });
  });
});
