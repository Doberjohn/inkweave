import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {Chip} from '../Chip';

describe('Chip', () => {
  describe('dismiss variant', () => {
    it('should render label text and × button', () => {
      render(<Chip variant="dismiss" label="Amber" onDismiss={vi.fn()} />);
      const btn = screen.getByRole('button');
      expect(btn).toHaveTextContent('Amber');
      expect(btn).toHaveTextContent('×');
    });

    it('should call onDismiss when clicked', () => {
      const onDismiss = vi.fn();
      render(<Chip variant="dismiss" label="Ruby" onDismiss={onDismiss} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onDismiss).toHaveBeenCalledOnce();
    });

    it('should use compact padding in mobile mode', () => {
      const {container} = render(
        <Chip variant="dismiss" label="Test" onDismiss={vi.fn()} isMobile />,
      );
      const btn = container.querySelector('button')!;
      expect(btn.style.padding).toBe('5px 8px 5px 10px');
    });
  });

  describe('toggle variant', () => {
    it('should render label without × button', () => {
      render(<Chip label="All" active={false} onClick={vi.fn()} />);
      const btn = screen.getByRole('button');
      expect(btn).toHaveTextContent('All');
      expect(btn).not.toHaveTextContent('×');
    });

    it('should call onClick when clicked', () => {
      const onClick = vi.fn();
      render(<Chip label="Shift" active={false} onClick={onClick} />);
      fireEvent.click(screen.getByRole('button'));
      expect(onClick).toHaveBeenCalledOnce();
    });

    it('should render children (e.g., count badge)', () => {
      render(
        <Chip label="Payoff" active={true} onClick={vi.fn()}>
          <span data-testid="count">5</span>
        </Chip>,
      );
      expect(screen.getByTestId('count')).toHaveTextContent('5');
    });

    it('should render title attribute for tooltips', () => {
      render(
        <Chip label="Tutor" active={false} onClick={vi.fn()} title="Searches for locations" />,
      );
      expect(screen.getByRole('button')).toHaveAttribute('title', 'Searches for locations');
    });

    it('should set aria-pressed=true when active', () => {
      render(<Chip label="All" active={true} onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true');
    });

    it('should set aria-pressed=false when inactive', () => {
      render(<Chip label="All" active={false} onClick={vi.fn()} />);
      expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false');
    });
  });

  describe('dismiss variant accessibility', () => {
    it('should not have aria-pressed', () => {
      render(<Chip variant="dismiss" label="Amber" onDismiss={vi.fn()} />);
      expect(screen.getByRole('button')).not.toHaveAttribute('aria-pressed');
    });
  });
});
