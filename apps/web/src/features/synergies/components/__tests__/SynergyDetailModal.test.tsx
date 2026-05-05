import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyDetailModal} from '../SynergyDetailModal';
import {createCard, createConnection, createPairSynergy} from '../../../../shared/test-utils';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

// EngineColumn + CommunityColumn each own their own hook chain (useQuickVote / usePairScore /
// CtaButton-with-useBoop). Stubbing them keeps the modal test focused on the modal's direct
// responsibilities (header, card images, layout) rather than the columns' internals.
vi.mock('../CommunityColumn', () => ({
  CommunityColumn: () => <div data-testid="community-column" />,
}));

vi.mock('../EngineColumn', () => ({
  EngineColumn: ({pair}: {pair: {connections: {ruleName: string}[]}}) => (
    <div data-testid="engine-column">
      {pair.connections.map((c, i) => (
        <span key={i} data-testid="connection-group">
          {c.ruleName}
        </span>
      ))}
    </div>
  ),
}));

vi.mock('../../../../shared/components', () => ({
  CardImage: ({alt}: {alt: string}) => <div data-testid="card-image">{alt}</div>,
  CardLightbox: () => null,
  RenderProfiler: ({children}: {children: React.ReactNode}) => <>{children}</>,
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
    // EngineColumn renders the connections — stub above turns them into spans
    expect(screen.getByText('Shift Targets')).toBeInTheDocument();
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


  it('mounts engine + community columns side by side', () => {
    render(
      <SynergyDetailModal isOpen onClose={vi.fn()} pair={mockPair} />,
    );
    expect(screen.getByTestId('engine-column')).toBeInTheDocument();
    expect(screen.getByTestId('community-column')).toBeInTheDocument();
  });
});
