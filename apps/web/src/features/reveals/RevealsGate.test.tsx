import {describe, expect, it, vi, beforeEach} from 'vitest';
import {render, screen} from '@testing-library/react';
import {MemoryRouter} from 'react-router-dom';
import {RevealsGate} from './RevealsGate';
import type {RevealPhase} from './useRevealPhase';

const phase = vi.hoisted(() => ({current: 'pre-release' as RevealPhase}));
vi.mock('./useRevealPhase', () => ({useRevealPhase: () => phase.current}));
vi.mock('./revealDates', () => ({useRevealDates: () => null}));

function renderGate() {
  return render(
    <MemoryRouter>
      <RevealsGate>
        <div data-testid="reveals-page">the reveals page</div>
      </RevealsGate>
    </MemoryRouter>,
  );
}

describe('RevealsGate', () => {
  beforeEach(() => {
    phase.current = 'pre-release';
  });

  it.each(['pre-release', 'pre-release-live'] as const)('renders the page during %s', (p) => {
    phase.current = p;
    renderGate();
    expect(screen.getByTestId('reveals-page')).toBeInTheDocument();
  });

  it('renders the page while loading, so it never redirects before dates resolve', () => {
    phase.current = 'loading';
    renderGate();
    expect(screen.getByTestId('reveals-page')).toBeInTheDocument();
  });

  it.each(['hidden', 'released'] as const)('shows the off-season notice for %s, not a redirect', (p) => {
    phase.current = p;
    renderGate();
    expect(screen.queryByTestId('reveals-page')).not.toBeInTheDocument();
    expect(screen.getByRole('button', {name: /return to inkweave/i})).toBeInTheDocument();
  });
});
