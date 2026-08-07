import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {BackLink} from '../BackLink';

const withRouter = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe('BackLink', () => {
  it('renders the label with an arrow', () => {
    render(<BackLink onClick={vi.fn()} label="Back to all synergies" />);
    expect(screen.getByText(/Back to all synergies/)).toBeTruthy();
    expect(screen.getByRole('button').textContent).toContain('←');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<BackLink onClick={onClick} label="Back" />);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  /*
    The reason for the rebuild. As a button-only component it could not express a real
    destination, so every URL-based back link hand-rolled an anchor and the pattern
    forked five ways. These two assert the union actually renders two elements — a
    regression to button-only would pass every other test in this file.
  */
  it('renders a real link when given a destination', () => {
    withRouter(<BackLink to="/decks" label="Back to decks" />);
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('/decks');
  });

  it('renders a button, not a link, when given a handler', () => {
    render(<BackLink onClick={vi.fn()} label="Back" />);
    expect(screen.getByRole('button')).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  // The arrow is decoration; a screen reader should hear "Back to decks", not
  // "left arrow Back to decks".
  it('hides the arrow from assistive tech', () => {
    withRouter(<BackLink to="/decks" label="Back to decks" />);
    expect(screen.getByRole('link').querySelector('[aria-hidden]')?.textContent).toBe('←');
  });
});
