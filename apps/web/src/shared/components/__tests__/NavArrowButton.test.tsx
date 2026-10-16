import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {NavArrowButton} from '../NavArrowButton';

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
});
