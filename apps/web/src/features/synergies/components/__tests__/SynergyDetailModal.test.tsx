import {describe, it, expect, vi} from 'vitest';
import {render, screen, fireEvent} from '@testing-library/react';
import {SynergyDetailModal} from '../SynergyDetailModal';
import type {
  DetailedPairSynergy,
  LorcanaCard,
  PairSynergyConnection,
} from 'inkweave-synergy-engine';

vi.mock('../../../shared/components', () => ({
  CardImage: ({alt}: {alt: string}) => <div data-testid="card-image">{alt}</div>,
}));

vi.mock('../../../shared/hooks/useDialogFocus', () => ({
  useDialogFocus: () => ({handleKeyDown: vi.fn()}),
}));

vi.mock('../../../shared/hooks', () => ({
  useTransitionPresence: (isOpen: boolean) => ({
    mounted: isOpen,
    visible: isOpen,
    onTransitionEnd: vi.fn(),
  }),
}));

vi.mock('../../../cards', () => ({
  useCardPreviewHandlers: () => ({previewHandlers: {}}),
  useCardPreview: () => ({hidePreview: vi.fn()}),
}));

const cardA: LorcanaCard = {
  id: 'elsa-shift',
  fullName: 'Elsa - Ice Artisan',
  name: 'Elsa',
  version: 'Ice Artisan',
  type: 'Character',
  ink: 'Amethyst',
  cost: 5,
  inkwell: true,
} as LorcanaCard;

const cardB: LorcanaCard = {
  id: 'elsa-base',
  fullName: 'Elsa - Snow Queen',
  name: 'Elsa',
  version: 'Snow Queen',
  type: 'Character',
  ink: 'Amethyst',
  cost: 3,
  inkwell: true,
} as LorcanaCard;

const connections: PairSynergyConnection[] = [
  {
    ruleId: 'shift-targets',
    ruleName: 'Shift Targets',
    category: 'direct',
    score: 8,
    explanation: 'Elsa - Snow Queen can Shift onto Elsa - Ice Artisan.',
  },
  {
    ruleId: 'lore-steal',
    ruleName: 'Lore Steal',
    category: 'playstyle',
    playstyleId: 'lore-denial',
    score: 7,
    explanation: 'Both make the opponent lose lore.',
  },
];

const mockPair: DetailedPairSynergy = {
  cardA,
  cardB,
  connections,
  aggregateScore: 8,
};

describe('SynergyDetailModal', () => {
  it('should not render when closed', () => {
    render(
      <SynergyDetailModal
        isOpen={false}
        onClose={vi.fn()}
        pair={mockPair}
        onViewSynergies={vi.fn()}
      />,
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('should render dialog with card names and connections when open', () => {
    render(
      <SynergyDetailModal isOpen onClose={vi.fn()} pair={mockPair} onViewSynergies={vi.fn()} />,
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Shift Targets')).toBeInTheDocument();
    // Playstyle connections are grouped by playstyleId — "Lore Steal" is the group label
    expect(screen.getByText('Lore Steal')).toBeInTheDocument();
  });

  it('should call onClose when backdrop is clicked', () => {
    const onClose = vi.fn();
    render(
      <SynergyDetailModal isOpen onClose={onClose} pair={mockPair} onViewSynergies={vi.fn()} />,
    );
    fireEvent.click(screen.getByTestId('synergy-detail-backdrop'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();
    render(
      <SynergyDetailModal isOpen onClose={onClose} pair={mockPair} onViewSynergies={vi.fn()} />,
    );
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('should show version when both cards share the same name', () => {
    render(
      <SynergyDetailModal isOpen onClose={vi.fn()} pair={mockPair} onViewSynergies={vi.fn()} />,
    );
    expect(screen.getByText('Ice Artisan')).toBeInTheDocument();
    expect(screen.getByText('Snow Queen')).toBeInTheDocument();
  });

  it('should hide version when cards have different names', () => {
    const differentPair: DetailedPairSynergy = {
      ...mockPair,
      cardB: {...cardB, name: 'Olaf', version: 'Friendly Snowman'},
    };
    render(
      <SynergyDetailModal
        isOpen
        onClose={vi.fn()}
        pair={differentPair}
        onViewSynergies={vi.fn()}
      />,
    );
    expect(screen.queryByText('Ice Artisan')).not.toBeInTheDocument();
    expect(screen.queryByText('Friendly Snowman')).not.toBeInTheDocument();
  });

  it('should call onViewSynergies with cardB id when CTA is clicked', () => {
    const onViewSynergies = vi.fn();
    render(
      <SynergyDetailModal
        isOpen
        onClose={vi.fn()}
        pair={mockPair}
        onViewSynergies={onViewSynergies}
      />,
    );
    fireEvent.click(screen.getByTestId('synergy-detail-cta'));
    expect(onViewSynergies).toHaveBeenCalledWith('elsa-base');
  });
});
