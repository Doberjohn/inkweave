import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MobileNav} from '../MobileNav';

describe('MobileNav', () => {
  const defaultProps = {
    activeView: 'cards' as const,
    onViewChange: vi.fn(),
  };

  it('should mark active view with aria-pressed', () => {
    const {rerender} = render(<MobileNav {...defaultProps} activeView="cards" />);

    expect(screen.getByRole('button', {name: /cards/i})).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', {name: /synergies/i})).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    rerender(<MobileNav {...defaultProps} activeView="synergies" />);

    expect(screen.getByRole('button', {name: /cards/i})).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByRole('button', {name: /synergies/i})).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('should call onViewChange with correct view when clicking buttons', () => {
    const onViewChange = vi.fn();
    render(<MobileNav {...defaultProps} onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole('button', {name: /cards/i}));
    expect(onViewChange).toHaveBeenCalledWith('cards');

    fireEvent.click(screen.getByRole('button', {name: /synergies/i}));
    expect(onViewChange).toHaveBeenCalledWith('synergies');
  });

  it('should render two navigation buttons', () => {
    render(<MobileNav {...defaultProps} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(2);
  });
});
