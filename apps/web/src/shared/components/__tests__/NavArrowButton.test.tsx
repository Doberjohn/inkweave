import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {NavArrowButton} from '../NavArrowButton';
import {DISABLED_STYLE} from '../../constants';

describe('NavArrowButton', () => {
  it('shows its word beside the chevron, keeping the fuller name for screen readers', () => {
    render(<NavArrowButton direction="next" label="Next spread" text="Next" onClick={() => {}} />);
    const button = screen.getByRole('button', {name: 'Next spread'});
    expect(button).toHaveTextContent('Next');
  });

  it('stays a bare arrow without one', () => {
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
});
