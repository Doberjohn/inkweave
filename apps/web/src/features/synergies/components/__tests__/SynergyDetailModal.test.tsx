import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyDetailModal} from '../SynergyDetailModal';
import {createCard, createConnection, createPairSynergy} from '../../../../shared/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../../../voting/hooks', () => ({
  useQuickVote: vi.fn().mockReturnValue({
    state: 'ready',
    vote: vi.fn(),
    distribution: null,
    userChoice: null,
    error: null,
  }),
}));

vi.mock('../../../../shared/components', () => ({
  CardImage: ({alt}: {alt: string}) => <div data-testid="card-image">{alt}</div>,
  CardLightbox: () => null,
  RenderProfiler: ({children}: {children: React.ReactNode}) => <>{children}</>,
  StrengthBadge: ({score}: {score: number}) => <span data-testid="strength-badge">{score}</span>,
  ConnectionGroup: ({group}: {group: {label: string}}) => <div data-testid="connection-group">{group.label}</div>,
  groupConnections: (conns: unknown[]) => conns.map((c: Record<string, unknown>) => ({key: c.ruleId, label: c.ruleName, score: c.score, connections: [c], category: c.category})),
}));

vi.mock('../../../../shared/hooks/useDialogFocus', () => ({
  useDialogFocus: () => ({handleKeyDown: vi.fn()}),
}));

vi.mock('../../../../shared/hooks', () => ({
  useTransitionPresence: (isOpen: boolean) => ({
    mounted: isOpen,
    visible: isOpen,
    onTransitionEnd: vi.fn(),
  }),
  useScrollLock: vi.fn(),
  useResponsive: () => ({isMobile: false}),
}));

const cardA = createCard({
  id: 'elsa-shift',
  fullName: 'Elsa - Ice Artisan',
  name: 'Elsa',
  version: 'Ice Artisan',
  ink: 'Amethyst',
  cost: 5,
});

const cardB = createCard({
  id: 'elsa-base',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  version: 'Snow Queen',
  ink: 'Amethyst',
  cost: 3,
});

const mockPair = createPairSynergy({
  cardA,
  cardB,
  connections: [
    createConnection({
      ruleId: 'shift-targets',
      ruleName: 'Shift Targets',
      category: 'direct',
      score: 8,
      explanation: 'Elsa - Snow Queen can Shift onto Elsa - Ice Artisan.',
    }),
    createConnection({
      ruleId: 'lore-steal',
      ruleName: 'Lore Steal',
      category: 'playstyle',
      playstyleId: 'lore-denial',
      score: 7,
      explanation: 'Both make the opponent lose lore.',
    }),
  ],
  aggregateScore: 8,
});

describe('SynergyDetailModal', () => {
  it('should not render when closed', () => {
    render(
      <SynergyDetailModal
        isOpen={false}
        onClose={vi.fn()}
        pair={mockPair}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render dialog with card names and connections when open', () => {
    render(
      <SynergyDetailModal isOpen onClose={vi.fn()} pair={mockPair} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Shift Targets')).toBeInTheDocument();
    // Playstyle connections are grouped by playstyleId. "Lore Steal" is the group label.
    expect(screen.getByText('Lore Steal')).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <SynergyDetailModal isOpen onClose={onClose} pair={mockPair} />,
    );
    fireEvent.click(screen.getByTestId('synergy-detail-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });


  it('renders quick vote control below tier label', () => {
    render(
      <SynergyDetailModal
        isOpen={true}
        onClose={vi.fn()}
        pair={mockPair}
             />,
    );
    expect(screen.getByText('Do you agree with this score?')).toBeInTheDocument();
  });
});
