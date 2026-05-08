import {describe, it, expect, vi, beforeEach} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import type {LorcanaCard} from '../../../features/cards';
import type {PairSynergyConnection} from 'inkweave-synergy-engine';
import type {ConnectionGroupData} from '../groupConnections';

const mockUseResponsive = vi.fn(() => ({
  isMobile: false,
  isTablet: false,
  isDesktop: true,
  isTouchDevice: false,
  windowWidth: 1280,
}));

vi.mock('../../hooks', () => ({
  useResponsive: () => mockUseResponsive(),
}));

// Imported after the mock so the module reads the mocked hook.
import {ConnectionGroup} from '../ConnectionGroup';

const cardA: LorcanaCard = {
  id: 'elsa-cs',
  fullName: 'Elsa - Concerned Sister',
  name: 'Elsa',
  type: 'Character',
  ink: 'Amethyst',
} as unknown as LorcanaCard;

const cardB: LorcanaCard = {
  id: 'elsa-ia',
  fullName: 'Elsa - Ice Artisan',
  name: 'Elsa',
  type: 'Character',
  ink: 'Amethyst',
} as unknown as LorcanaCard;

function locConn(role: string, score: number): PairSynergyConnection {
  return {
    ruleId: `location-${role}`,
    ruleName: 'Location Control',
    category: 'playstyle',
    playstyleId: 'location-control',
    score,
    explanation: `Stub explanation for ${role}.`,
  };
}

function singleRoleGroup(): ConnectionGroupData {
  return {
    key: 'shift-targets',
    label: 'Shift Targets',
    score: 8,
    category: 'direct',
    connections: [
      {
        ruleId: 'shift-targets',
        ruleName: 'Shift Targets',
        category: 'direct',
        score: 8,
        explanation: 'Pair lines up perfectly for Shift.',
      },
    ],
  };
}

function multiRoleGroup(): ConnectionGroupData {
  // Score-shuffled to verify the component sorts by score desc.
  return {
    key: 'location-control',
    label: 'Location Control',
    score: 7,
    category: 'playstyle',
    connections: [locConn('move', 5), locConn('at-payoff', 7), locConn('buff', 6)],
  };
}

describe('ConnectionGroup — multi-role expand/collapse', () => {
  beforeEach(() => {
    mockUseResponsive.mockReturnValue({
      isMobile: false,
      isTablet: false,
      isDesktop: true,
      isTouchDevice: false,
      windowWidth: 1280,
    });
  });

  it('renders a single AbilityRow with no toggle when the group has one connection', () => {
    render(<ConnectionGroup group={singleRoleGroup()} cardA={cardA} cardB={cardB} />);
    expect(screen.getByText('Shift Targets')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('shows only the highest-scoring role on desktop with the toggle collapsed', () => {
    render(<ConnectionGroup group={multiRoleGroup()} cardA={cardA} cardB={cardB} />);
    // at-payoff is the score-7 entry → label "Payoff" must surface.
    expect(screen.getByText('Payoff')).toBeInTheDocument();
    // Move + Buff render too (in the absolute-positioned grid with 0fr height) but
    // their containing grid is collapsed. We assert via aria-expanded on the toggle.
    const toggle = screen.getByRole('button', {name: /show all 3 roles/i});
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on toggle click and updates aria-expanded', () => {
    render(<ConnectionGroup group={multiRoleGroup()} cardA={cardA} cardB={cardB} />);
    const toggle = screen.getByRole('button', {name: /show all 3 roles/i});
    fireEvent.click(toggle);
    expect(screen.getByRole('button', {name: /hide additional roles/i})).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('collapses again on second toggle click', () => {
    render(<ConnectionGroup group={multiRoleGroup()} cardA={cardA} cardB={cardB} />);
    const toggle = screen.getByRole('button');
    fireEvent.click(toggle);
    fireEvent.click(toggle);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('closes on Escape when expanded', () => {
    render(<ConnectionGroup group={multiRoleGroup()} cardA={cardA} cardB={cardB} />);
    fireEvent.click(screen.getByRole('button'));
    fireEvent.keyDown(window, {key: 'Escape'});
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('renders all roles always-open with no toggle on mobile', () => {
    mockUseResponsive.mockReturnValue({
      isMobile: true,
      isTablet: false,
      isDesktop: false,
      isTouchDevice: true,
      windowWidth: 480,
    });
    render(<ConnectionGroup group={multiRoleGroup()} cardA={cardA} cardB={cardB} />);
    expect(screen.getByText('Payoff')).toBeInTheDocument();
    expect(screen.getByText('Move')).toBeInTheDocument();
    expect(screen.getByText('Buff')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
  });
});
