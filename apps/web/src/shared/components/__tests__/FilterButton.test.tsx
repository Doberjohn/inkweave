import {describe, it, expect} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {FilterButton} from '../FilterButton';

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
        <FilterButton active={true} onClick={() => {}} activeColor="#f59e0b" activeBgColor="#3d2e10">
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      // jsdom normalizes hex to rgb: #3d2e10 → rgb(61, 46, 16)
      expect(button.style.background).toContain('61, 46, 16');
    });

    it('should fall back to activeColor for background when activeBgColor not provided', () => {
      render(
        <FilterButton active={true} onClick={() => {}} activeColor="#d4af37">
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      // #d4af37 → rgb(212, 175, 55)
      expect(button.style.background).toContain('212, 175, 55');
    });

    it('should use activeColor for border when active', () => {
      render(
        <FilterButton active={true} onClick={() => {}} activeColor="#f59e0b" activeBgColor="#3d2e10">
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      // Border should reference the activeColor (bright accent), not the bg color
      expect(button.style.border).toContain('245, 158, 11');
    });

    it('should have a box-shadow when active', () => {
      render(
        <FilterButton active={true} onClick={() => {}} activeColor="#f59e0b">
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
        <FilterButton active={false} onClick={() => {}} inactiveColor="#1e1e35">
          Test
        </FilterButton>,
      );

      const button = screen.getByRole('button');
      // #1e1e35 → rgb(30, 30, 53)
      expect(button.style.background).toContain('30, 30, 53');
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
      expect(button.style.padding).toBe('5px 10px');
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
